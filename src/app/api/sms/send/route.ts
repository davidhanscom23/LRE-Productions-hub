import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendToPhone, sendToStaff } from "@/lib/sms/store";

/** Send a single SMS to a staff member or a raw number (admins only). */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { to?: unknown; staffId?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message : "";
  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  let result;
  if (typeof body.staffId === "string" && body.staffId) {
    result = await sendToStaff(body.staffId, message, profile.id);
  } else if (typeof body.to === "string" && body.to) {
    result = await sendToPhone(body.to, message, profile.id);
  } else {
    return NextResponse.json(
      { error: "Pick a staff member or enter a number." },
      { status: 400 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sid: result.sid });
}
