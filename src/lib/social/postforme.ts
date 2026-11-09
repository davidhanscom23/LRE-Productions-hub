import "server-only";

/**
 * Shared Post for Me (https://postforme.dev) client.
 * Used by TikTok, LinkedIn, and future Threads/Pinterest publishers.
 */

import type { PostForMeAccount } from "@/lib/social/postforme-types";

export type { PostForMeAccount } from "@/lib/social/postforme-types";

const API_BASE = "https://api.postforme.dev";
const CREATE_POST_URL = `${API_BASE}/v1/social-posts`;
const LIST_ACCOUNTS_URL = `${API_BASE}/v1/social-accounts`;

export function isPostForMeConfigured(): boolean {
  return Boolean(process.env.POSTFORME_API_KEY?.trim());
}

function postForMeApiKey(): string | null {
  const key = process.env.POSTFORME_API_KEY?.trim() ?? "";
  return key || null;
}

let accountsCache: { at: number; accounts: PostForMeAccount[] } | null = null;
const ACCOUNTS_CACHE_MS = 60_000;

function normalizeAccounts(payload: unknown): PostForMeAccount[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data ?? [])
      : [];

  const out: PostForMeAccount[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    // Post for Me returns the network as `platform` (e.g. "linkedin",
    // "tiktok"); accept `provider` too for safety.
    const provider = String(row.platform ?? row.provider ?? "")
      .trim()
      .toLowerCase();
    const username =
      String(row.username ?? row.name ?? row.display_name ?? id).trim() || id;
    out.push({ id, provider, username });
  }
  return out;
}

/** Connected Post for Me accounts (cached ~60s). Empty if unconfigured or on error. */
export async function listPostForMeAccounts(): Promise<PostForMeAccount[]> {
  const apiKey = postForMeApiKey();
  if (!apiKey) return [];

  if (accountsCache && Date.now() - accountsCache.at < ACCOUNTS_CACHE_MS) {
    return accountsCache.accounts;
  }

  try {
    const res = await fetch(LIST_ACCOUNTS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(
        "[postforme] list accounts failed",
        res.status,
        typeof json === "object" ? json : null,
      );
      return [];
    }
    const accounts = normalizeAccounts(json);
    accountsCache = { at: Date.now(), accounts };
    return accounts;
  } catch (err) {
    console.error("[postforme] list accounts error", err);
    return [];
  }
}

export async function listPostForMeAccountsByProvider(
  provider: string,
): Promise<PostForMeAccount[]> {
  const needle = provider.trim().toLowerCase();
  const all = await listPostForMeAccounts();
  return all.filter((a) => a.provider === needle);
}

export type PublishViaPostForMeInput = {
  accountId: string;
  caption: string;
  mediaUrls: string[];
  platformConfig?: Record<string, unknown>;
};

/**
 * Create a social post via Post for Me. Returned id means accepted
 * (async processing), not necessarily delivered.
 */
export async function publishViaPostForMe(
  provider: string,
  input: PublishViaPostForMeInput,
): Promise<{ externalPostId: string | null; error: string | null }> {
  const apiKey = postForMeApiKey();
  if (!apiKey) {
    return {
      externalPostId: null,
      error: "Post for Me is not configured. Set POSTFORME_API_KEY.",
    };
  }

  const accountId = input.accountId.trim();
  if (!accountId) {
    return {
      externalPostId: null,
      error: `Choose a ${provider} brand/page for this draft.`,
    };
  }

  const caption = input.caption.trim();
  if (!caption) {
    return {
      externalPostId: null,
      error: `Add a caption before posting to ${provider}.`,
    };
  }

  const media = input.mediaUrls
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => ({ url }));

  const body: Record<string, unknown> = {
    caption: caption.slice(0, 4000),
    social_accounts: [accountId],
    media,
  };

  // Include even empty configs (e.g. Threads → { threads: {} }).
  if (input.platformConfig !== undefined) {
    body.platform_configurations = {
      [provider]: input.platformConfig,
    };
  }

  let res: Response;
  try {
    res = await fetch(CREATE_POST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return {
      externalPostId: null,
      error:
        err instanceof Error
          ? `Post for Me request failed: ${err.message}`
          : "Post for Me request failed.",
    };
  }

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    errors?: Array<{ message?: string }>;
    error?: { message?: string } | string;
    message?: string;
  };

  if (!res.ok || !json.id) {
    const message =
      json.errors?.[0]?.message ??
      (typeof json.error === "string" ? json.error : json.error?.message) ??
      json.message ??
      `Post for Me publish failed (${res.status}).`;
    return { externalPostId: null, error: message };
  }

  return { externalPostId: json.id, error: null };
}
