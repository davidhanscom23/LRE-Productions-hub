import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import { randomBytes, randomInt } from "crypto";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export type ShowRemoteState = Record<string, unknown>;

export type ShowCommand = {
  seq: number;
  c: string;
  v: string;
};

function db() {
  return createServiceClient();
}

function newPin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

function newControlToken(): string {
  return randomBytes(24).toString("hex");
}

export async function createShowSession(): Promise<{
  id: string;
  pin: string;
  controlToken: string;
  expiresAt: string;
}> {
  const supabase = db();
  // Opportunistic cleanup of expired sessions.
  await supabase
    .from("av_show_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());

  for (let attempt = 0; attempt < 8; attempt++) {
    const pin = newPin();
    const controlToken = newControlToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const { data, error } = await supabase
      .from("av_show_sessions")
      .insert({
        pin,
        control_token: controlToken,
        expires_at: expiresAt,
        next_seq: 0,
        state: {},
      })
      .select("id")
      .single();
    if (!error && data) {
      return {
        id: data.id as string,
        pin,
        controlToken,
        expiresAt,
      };
    }
    // Retry on unique pin collisions (rare with 4 digits while active).
  }
  throw new Error("Could not create a remote session.");
}

async function loadSessionByPin(pin: string) {
  const cleaned = String(pin || "").trim();
  if (!/^\d{4,8}$/.test(cleaned)) return null;
  const { data } = await db()
    .from("av_show_sessions")
    .select("id, pin, control_token, next_seq, state, expires_at")
    .eq("pin", cleaned)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function loadSessionByToken(token: string) {
  const cleaned = String(token || "").trim();
  if (cleaned.length < 16) return null;
  const { data } = await db()
    .from("av_show_sessions")
    .select("id, pin, control_token, next_seq, state, expires_at")
    .eq("control_token", cleaned)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

export async function enqueueCommandByPin(
  pin: string,
  command: string,
  value = "",
): Promise<{ ok: true; seq: number } | { ok: false; error: string }> {
  const cmd = String(command || "").trim().toLowerCase();
  if (!cmd || cmd.length > 40) return { ok: false, error: "Bad command." };
  const session = await loadSessionByPin(pin);
  if (!session) return { ok: false, error: "Unknown or expired PIN." };

  const supabase = db();
  const nextSeq = Number(session.next_seq) + 1;
  const { error: updErr } = await supabase
    .from("av_show_sessions")
    .update({
      next_seq: nextSeq,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("next_seq", session.next_seq);
  if (updErr) return { ok: false, error: updErr.message };

  const { error } = await supabase.from("av_show_commands").insert({
    session_id: session.id,
    seq: nextSeq,
    command: cmd,
    value: String(value ?? "").slice(0, 500),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, seq: nextSeq };
}

export async function pollCommandsAfter(
  controlToken: string,
  afterSeq: number,
): Promise<
  | { ok: true; pin: string; commands: ShowCommand[]; expiresAt: string }
  | { ok: false; error: string }
> {
  const session = await loadSessionByToken(controlToken);
  if (!session) return { ok: false, error: "Session expired." };
  const after = Math.max(0, Math.floor(Number(afterSeq) || 0));
  const { data, error } = await db()
    .from("av_show_commands")
    .select("seq, command, value")
    .eq("session_id", session.id)
    .gt("seq", after)
    .order("seq", { ascending: true })
    .limit(50);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    pin: String(session.pin),
    expiresAt: String(session.expires_at),
    commands: (data ?? []).map((row) => ({
      seq: Number(row.seq),
      c: String(row.command),
      v: String(row.value ?? ""),
    })),
  };
}

export async function saveShowState(
  controlToken: string,
  state: ShowRemoteState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await loadSessionByToken(controlToken);
  if (!session) return { ok: false, error: "Session expired." };
  const { error } = await db()
    .from("av_show_sessions")
    .update({
      state: state ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loadShowStateByPin(
  pin: string,
): Promise<
  | { ok: true; state: ShowRemoteState; expiresAt: string }
  | { ok: false; error: string }
> {
  const session = await loadSessionByPin(pin);
  if (!session) return { ok: false, error: "Unknown or expired PIN." };
  return {
    ok: true,
    state: (session.state as ShowRemoteState) || {},
    expiresAt: String(session.expires_at),
  };
}

export async function sessionInfoByToken(controlToken: string): Promise<
  | { ok: true; pin: string; expiresAt: string }
  | { ok: false; error: string }
> {
  const session = await loadSessionByToken(controlToken);
  if (!session) return { ok: false, error: "Session expired." };
  return {
    ok: true,
    pin: String(session.pin),
    expiresAt: String(session.expires_at),
  };
}

/** Extend an active Hub remote session by another TTL window. */
export async function extendShowSession(
  controlToken: string,
): Promise<
  | { ok: true; pin: string; expiresAt: string }
  | { ok: false; error: string }
> {
  const session = await loadSessionByToken(controlToken);
  if (!session) return { ok: false, error: "Session expired." };
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await db()
    .from("av_show_sessions")
    .update({
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, pin: String(session.pin), expiresAt };
}

export { SESSION_TTL_MS };
