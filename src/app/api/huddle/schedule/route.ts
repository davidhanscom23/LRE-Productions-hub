import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { scheduleHuddle } from "@/lib/huddle/store";

/** Schedule a team huddle for a future time (admins only). */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { scheduledAt?: unknown; topic?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.scheduledAt !== "string") {
    return NextResponse.json({ error: "A start time is required." }, { status: 400 });
  }

  const result = await scheduleHuddle(
    profile.id,
    body.scheduledAt,
    typeof body.topic === "string" ? body.topic : undefined,
    { force: body.force === true },
  );
  if ("error" in result) {
    const status = result.code === "calendar_conflict" ? 409 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
