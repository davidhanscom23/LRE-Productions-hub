import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { listConversations, isSmsConfigured } from "@/lib/sms/store";

/** List SMS conversations for the portal (admins only). */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const conversations = await listConversations();
  return NextResponse.json({ configured: isSmsConfigured(), conversations });
}
