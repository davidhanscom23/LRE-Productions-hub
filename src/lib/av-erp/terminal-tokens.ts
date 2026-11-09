import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hashIntegrationToken,
  hashesMatch,
  mintApiTokenPlaintext,
  scopesInclude,
} from "@/lib/av-erp/terminal-token-crypto";
import type {
  AvIntegrationTokenRow,
  AvTokenScope,
} from "@/lib/av-erp/terminal-token-types";

export type { AvIntegrationTokenRow, AvTokenScope };
export { hashIntegrationToken, mintApiTokenPlaintext, scopesInclude };

export async function listIntegrationTokens(
  supabase: SupabaseClient,
): Promise<AvIntegrationTokenRow[]> {
  const { data, error } = await supabase
    .from("av_integration_tokens")
    .select(
      "id, label, kind, token_prefix, scopes, last_used_at, revoked_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AvIntegrationTokenRow[];
}

export async function createIntegrationToken(
  supabase: SupabaseClient,
  input: {
    label: string;
    scopes: AvTokenScope[];
    createdBy: string | null;
  },
): Promise<{ row: AvIntegrationTokenRow; plaintext: string }> {
  const label = input.label.trim();
  if (label.length < 1 || label.length > 60) {
    throw new Error("Name the key after where it is used (1–60 characters).");
  }
  const scopes = Array.from(
    new Set<AvTokenScope>(["read", ...input.scopes]),
  );
  const minted = mintApiTokenPlaintext();
  const { data, error } = await supabase
    .from("av_integration_tokens")
    .insert({
      label,
      kind: "api",
      token_prefix: minted.prefix,
      token_hash: minted.hash,
      scopes,
      created_by: input.createdBy,
    })
    .select(
      "id, label, kind, token_prefix, scopes, last_used_at, revoked_at, created_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return { row: data as AvIntegrationTokenRow, plaintext: minted.plaintext };
}

export async function revokeIntegrationToken(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("av_integration_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}

/**
 * Resolve a Bearer token against hashed rows (service-role client).
 * Returns null when missing/revoked/mismatch.
 */
export async function resolveIntegrationToken(
  supabase: SupabaseClient,
  plaintext: string,
): Promise<AvIntegrationTokenRow | null> {
  const clean = plaintext.trim();
  if (!clean.startsWith("avk_live_")) return null;
  const hash = hashIntegrationToken(clean);
  const { data, error } = await supabase
    .from("av_integration_tokens")
    .select(
      "id, label, kind, token_prefix, scopes, last_used_at, revoked_at, created_at, created_by, token_hash",
    )
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  const stored = String((data as { token_hash?: string }).token_hash ?? "");
  if (!hashesMatch(stored, hash)) return null;
  await supabase
    .from("av_integration_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  const { token_hash: _drop, ...row } = data as AvIntegrationTokenRow & {
    token_hash: string;
  };
  void _drop;
  return row;
}

export function bearerFromRequest(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}
