import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmailDetailed } from "@/lib/email/send";

/** Send a test email (defaults to the admin's own address). */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { to?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const to =
    typeof body.to === "string" && body.to.trim() ? body.to.trim() : profile.email;
  if (!to) {
    return NextResponse.json({ error: "No recipient address." }, { status: 400 });
  }

  const result = await sendEmailDetailed({
    to,
    subject: "LRE Productions Hub — test email",
    text: "This is a test email from the Hub's Communications test center. If you received it, email delivery is working.",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.skipped
          ? "Email isn't configured (RESEND_API_KEY / EMAIL_FROM)."
          : result.error || "Email failed to send.",
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, to });
}
