import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createShowSession } from "@/lib/av-show/remote-store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const runtime = "nodejs";

/** Staff: start a Hub remote session (PIN + control token). */
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile || !canAccessVidentAv(profile)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Service role is not configured." },
      { status: 503 },
    );
  }
  try {
    const session = await createShowSession();
    return NextResponse.json({
      pin: session.pin,
      controlToken: session.controlToken,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create session.";
    if (/av_show_sessions|relation|column/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Show remote needs migration 156_invoice_pay_catalog_show_remote.sql in Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
