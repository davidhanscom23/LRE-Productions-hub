import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { bulkSendToStaff } from "@/lib/sms/store";

/** Send one SMS to many staff, optionally filtered by department (admins only). */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { department?: unknown; staffIds?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message : "";
  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const department =
    typeof body.department === "string" && body.department ? body.department : null;
  const staffIds = Array.isArray(body.staffIds)
    ? body.staffIds.filter((x): x is string => typeof x === "string")
    : undefined;

  const outcome = await bulkSendToStaff({
    department,
    staffIds,
    body: message,
    sentBy: profile.id,
  });
  return NextResponse.json({ ok: true, ...outcome });
}
