import "server-only";

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendEmailDetailed } from "@/lib/email/send";
import { insertNotifications } from "@/lib/notifications/notify";
import {
  computeStatus,
  type PortalFileLite,
  type PortalStatus,
  type PortalValues,
  type StoredFileKey,
} from "./items";
import { buildEmail, portalUrl, type EmailKind, type EmailPortal } from "./emails";
import { daysUntil, todayInEastern } from "./cadence";

export const PORTAL_BUCKET = "av-portal-files";
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export type PortalRow = EmailPortal & {
  id: string;
  client_email: string;
  cc_emails: string[];
  load_in_time: string;
  is_active: boolean;
  completed_at: string | null;
  last_client_activity_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type PortalFileRow = PortalFileLite & {
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  matched_by: string;
  created_at: string;
};

export function newPortalToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function fetchPortalByToken(token: string): Promise<PortalRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await createServiceClient()
    .from("av_event_portals")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as PortalRow | null) ?? null;
}

export async function fetchPortalById(id: string): Promise<PortalRow | null> {
  const { data } = await createServiceClient()
    .from("av_event_portals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as PortalRow | null) ?? null;
}

export async function fetchPortalState(portalId: string): Promise<{
  values: PortalValues;
  files: PortalFileRow[];
  status: PortalStatus;
}> {
  const supabase = createServiceClient();
  const [{ data: vals }, { data: files }] = await Promise.all([
    supabase.from("av_event_portal_values").select("item_key, value").eq("portal_id", portalId),
    supabase
      .from("av_event_portal_files")
      .select("id, item_key, file_name, storage_path, mime_type, size_bytes, matched_by, created_at")
      .eq("portal_id", portalId)
      .order("created_at", { ascending: true }),
  ]);
  const values: PortalValues = {};
  for (const v of (vals ?? []) as { item_key: string; value: unknown }[]) {
    (values as Record<string, unknown>)[v.item_key] = v.value;
  }
  const fileRows = (files ?? []) as PortalFileRow[];
  return { values, files: fileRows, status: computeStatus(values, fileRows) };
}

/**
 * Send one email for a portal. Scheduled kinds are claimed in the log first
 * (unique per show) so two overlapping runs can never double-send; a failed
 * send releases the claim so the next run retries.
 */
export async function sendPortalEmail(
  portal: PortalRow,
  kind: EmailKind,
  status: PortalStatus,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const supabase = createServiceClient();
  const recipients = [portal.client_email, ...(portal.cc_emails ?? [])].filter(Boolean);

  const { data: claim, error: claimErr } = await supabase
    .from("av_event_portal_emails")
    .insert({ portal_id: portal.id, kind, recipients })
    .select("id")
    .single();
  if (claimErr) {
    if (claimErr.code === "23505") return { ok: true, skipped: true };
    return { ok: false, error: claimErr.message };
  }

  const days = daysUntil(portal.event_date, todayInEastern());
  const msg = buildEmail({ kind, portal, status, daysLeft: days });
  const res = await sendEmailDetailed({ to: recipients, ...msg });
  if (!res.ok) {
    await supabase.from("av_event_portal_emails").delete().eq("id", claim.id);
    return { ok: false, skipped: res.skipped, error: res.error };
  }
  return { ok: true };
}

/**
 * Keep completed_at in step with the checklist. The first time every item is
 * in: thank the client once and tell the person who set the show up.
 */
export async function syncCompletion(portal: PortalRow, status: PortalStatus): Promise<void> {
  const supabase = createServiceClient();
  if (!status.allComplete) {
    if (portal.completed_at) {
      await supabase.from("av_event_portals").update({ completed_at: null }).eq("id", portal.id);
    }
    return;
  }
  if (portal.completed_at) return;

  const { data: marked } = await supabase
    .from("av_event_portals")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", portal.id)
    .is("completed_at", null)
    .select("id");
  if (!marked?.length) return; // another request got there first

  await sendPortalEmail(portal, "complete", status);
  if (portal.created_by) {
    await insertNotifications(supabase, [
      {
        userId: portal.created_by,
        kind: "av_portal",
        title: "AV event portal complete",
        body: `${portal.event_name}: the client has sent all six items.`,
        href: `/av-portals/${portal.id}`,
      },
    ]);
  }
}

export { portalUrl };
export type { StoredFileKey };
