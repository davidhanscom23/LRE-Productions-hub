import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isPushConfigured } from "@/lib/notifications/push";
import { insertNotifications } from "@/lib/notifications/notify";
import { createServiceClient } from "@/lib/supabase/admin";

/** Send a test push to the signed-in admin's own devices. */
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push isn't configured on the server (VAPID keys missing)." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id);

  if (!count) {
    return NextResponse.json(
      {
        error:
          "No devices are subscribed for your account yet. Turn on “Push notifications on this device” in Notification preferences first (from the installed home-screen app on iPhone).",
      },
      { status: 400 },
    );
  }

  // Insert a real in-app notification so the push carries a nonzero unread
  // count and the app icon badge appears — a true end-to-end test.
  await insertNotifications(supabase, [
    {
      userId: profile.id,
      kind: "test",
      title: "🔔 Test notification",
      body: "If you can see this, push notifications are working.",
      href: "/notifications",
    },
  ]);

  return NextResponse.json({ ok: true, devices: count });
}
