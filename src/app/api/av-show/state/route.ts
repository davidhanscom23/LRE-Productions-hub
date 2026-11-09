import { NextResponse } from "next/server";
import {
  loadShowStateByPin,
  saveShowState,
} from "@/lib/av-show/remote-store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Control page: publish on-air state for the phone remote. */
export async function POST(req: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  let body: { token?: string; state?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const token = String(body.token || "");
  const result = await saveShowState(token, body.state || {});
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** Phone remote: read latest on-air state by PIN. */
export async function GET(req: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  const pin = new URL(req.url).searchParams.get("pin") || "";
  const result = await loadShowStateByPin(pin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({
    state: result.state,
    expiresAt: result.expiresAt,
  });
}
