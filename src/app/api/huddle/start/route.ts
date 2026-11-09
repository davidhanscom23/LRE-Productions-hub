import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { startHuddle, startScheduledHuddle } from "@/lib/huddle/store";

/**
 * Start a team huddle + broadcast the join link (admins only).
 * With a body of `{ id }`, promotes that scheduled huddle to live; otherwise
 * starts a fresh immediate huddle.
 */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let id: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.id === "string") id = body.id;
  } catch {
    /* no body — immediate start */
  }

  const result = id
    ? await startScheduledHuddle(profile.id, id)
    : await startHuddle(profile.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result);
}
