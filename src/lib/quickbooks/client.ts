import "server-only";

import { decryptToken, encryptToken } from "./crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/stripe/server";

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SCOPE = "com.intuit.quickbooks.accounting";
const MINOR = 75;

export function qbConfig() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim() ?? "";
  // Sandbox unless explicitly set to production, so a first connect never touches real books.
  const production = process.env.QUICKBOOKS_ENVIRONMENT?.trim().toLowerCase() === "production";
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
    production,
    apiBase: production ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com",
    redirectUri: `${siteOrigin()}/api/quickbooks/callback`,
  };
}

export function qbAuthorizeUrl(state: string): string {
  const c = qbConfig();
  const p = new URLSearchParams({ client_id: c.clientId, response_type: "code", scope: SCOPE, redirect_uri: c.redirectUri, state });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in: number };

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const c = qbConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) throw new Error(`QuickBooks sign-in failed (${res.status}). Reconnect QuickBooks.`);
  return (await res.json()) as TokenResponse;
}

function rowFromTokens(t: TokenResponse) {
  const secret = qbConfig().clientSecret;
  const now = Date.now();
  return {
    access_token_enc: encryptToken(t.access_token, secret),
    refresh_token_enc: encryptToken(t.refresh_token, secret),
    access_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
    refresh_expires_at: new Date(now + t.x_refresh_token_expires_in * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}

export async function qbExchangeCode(code: string, realmId: string, profileId: string): Promise<void> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: qbConfig().redirectUri });
  const db = createServiceClient();
  let companyName = "";
  try {
    const res = await fetch(`${qbConfig().apiBase}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=${MINOR}`, {
      headers: { Authorization: `Bearer ${t.access_token}`, Accept: "application/json" },
    });
    if (res.ok) companyName = String(((await res.json()) as { CompanyInfo?: { CompanyName?: string } }).CompanyInfo?.CompanyName ?? "");
  } catch {
    /* name is cosmetic */
  }
  const { error } = await db
    .from("quickbooks_connection")
    .upsert({ id: 1, realm_id: realmId, company_name: companyName, connected_by: profileId, connected_at: new Date().toISOString(), ...rowFromTokens(t) });
  if (error) throw new Error(error.message);
}

export type QbConnection = { realmId: string; companyName: string; connectedAt: string; refreshExpiresAt: string };

export async function qbConnection(): Promise<QbConnection | null> {
  const { data } = await createServiceClient()
    .from("quickbooks_connection")
    .select("realm_id, company_name, connected_at, refresh_expires_at")
    .eq("id", 1)
    .maybeSingle();
  return data
    ? { realmId: String(data.realm_id), companyName: String(data.company_name ?? ""), connectedAt: String(data.connected_at), refreshExpiresAt: String(data.refresh_expires_at) }
    : null;
}

export async function qbDisconnect(): Promise<void> {
  await createServiceClient().from("quickbooks_connection").delete().eq("id", 1);
}

async function accessToken(): Promise<{ token: string; realmId: string }> {
  const db = createServiceClient();
  const { data: row } = await db.from("quickbooks_connection").select("*").eq("id", 1).maybeSingle();
  if (!row) throw new Error("QuickBooks isn't connected yet.");
  const secret = qbConfig().clientSecret;
  if (new Date(row.access_expires_at as string).getTime() - Date.now() > 120_000) {
    return { token: decryptToken(row.access_token_enc as string, secret), realmId: String(row.realm_id) };
  }
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptToken(row.refresh_token_enc as string, secret) });
  // The refresh token rotates: save the new one immediately.
  await db.from("quickbooks_connection").update(rowFromTokens(t)).eq("id", 1);
  return { token: t.access_token, realmId: String(row.realm_id) };
}

type Fault = { Fault?: { Error?: { Message?: string; Detail?: string }[] } };

export async function qb<T = Record<string, unknown>>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { token, realmId } = await accessToken();
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${qbConfig().apiBase}/v3/company/${realmId}${path}${sep}minorversion=${MINOR}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & Fault;
  if (!res.ok) {
    const e = json.Fault?.Error?.[0];
    throw new Error(`QuickBooks: ${e?.Detail || e?.Message || `request failed (${res.status})`}`);
  }
  return json;
}

export async function qbQuery<T>(sql: string, key: string): Promise<T[]> {
  const out = await qb<{ QueryResponse?: Record<string, T[]> }>("GET", `/query?query=${encodeURIComponent(sql)}`);
  return out.QueryResponse?.[key] ?? [];
}
