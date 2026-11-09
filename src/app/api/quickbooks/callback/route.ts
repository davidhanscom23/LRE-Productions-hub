import { getCurrentProfile } from "@/lib/auth/profile";
import { verifyState } from "@/lib/quickbooks/crypto";
import { qbConfig, qbExchangeCode } from "@/lib/quickbooks/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Intuit sends the admin back here with ?code, ?realmId and our signed ?state. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/quickbooks?${q}`, req.url));
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return new Response("Admins only", { status: 403 });
  const c = qbConfig();
  const code = url.searchParams.get("code") ?? "";
  const realmId = url.searchParams.get("realmId") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (url.searchParams.get("error")) return back("error=denied");
  if (!code || !/^\d{5,25}$/.test(realmId) || !verifyState(state, profile.id, c.clientSecret)) return back("error=bad-state");
  try {
    await qbExchangeCode(code, realmId, profile.id);
  } catch {
    return back("error=exchange");
  }
  return back("connected=1");
}
