import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { endHuddle } from "@/lib/huddle/store";

/**
 * End the current huddle, or cancel a scheduled one with `{ id }` (admins only).
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
    /* no body — end whatever is open */
  }

  await endHuddle(id);
  return NextResponse.json({ ok: true });
}
