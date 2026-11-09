import { getCurrentProfile } from "@/lib/auth/profile";
import { signState } from "@/lib/quickbooks/crypto";
import { qbAuthorizeUrl, qbConfig } from "@/lib/quickbooks/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Admin clicks Connect: send them to Intuit with a signed state. */
export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return new Response("Admins only", { status: 403 });
  const c = qbConfig();
  if (!c.configured) return NextResponse.redirect(new URL("/quickbooks?error=not-configured", req.url));
  return NextResponse.redirect(qbAuthorizeUrl(signState(profile.id, c.clientSecret)));
}
