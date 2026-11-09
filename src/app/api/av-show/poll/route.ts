import { NextResponse } from "next/server";
import { pollCommandsAfter } from "@/lib/av-show/remote-store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Control page: poll for queued remote commands. */
export async function GET(req: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const after = Number(url.searchParams.get("after") || "0");
  const result = await pollCommandsAfter(token, after);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({
    pin: result.pin,
    expiresAt: result.expiresAt,
    commands: result.commands,
  });
}
