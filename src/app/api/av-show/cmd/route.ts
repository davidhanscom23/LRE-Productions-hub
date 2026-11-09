import { NextResponse } from "next/server";
import { enqueueCommandByPin } from "@/lib/av-show/remote-store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Phone / Stream Deck: enqueue a command by PIN (GET or POST). */
async function handle(req: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  const url = new URL(req.url);
  let pin = url.searchParams.get("pin") || "";
  let c = url.searchParams.get("c") || "";
  let v = url.searchParams.get("v") || "";
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as {
        pin?: string;
        c?: string;
        v?: string;
      };
      pin = body.pin || pin;
      c = body.c || c;
      v = body.v ?? v;
    } catch {
      // keep query params
    }
  }
  const result = await enqueueCommandByPin(pin, c, v);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, seq: result.seq });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
