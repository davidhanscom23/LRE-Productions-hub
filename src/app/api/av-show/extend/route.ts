import { NextResponse } from "next/server";
import { extendShowSession } from "@/lib/av-show/remote-store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Control page: extend PIN session TTL. */
export async function POST(req: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const result = await extendShowSession(String(body.token || ""));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    pin: result.pin,
    expiresAt: result.expiresAt,
  });
}
