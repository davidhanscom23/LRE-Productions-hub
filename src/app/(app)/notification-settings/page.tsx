import { NotificationSettingsClient } from "@/components/notifications/notification-settings-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NotificationSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const { data: mutes } = await supabase
    .from("notification_mutes")
    .select("kind")
    .eq("user_id", profile.id);

  const mutedKinds = (mutes ?? []).map((m) => m.kind as string);

  return (
    <NotificationSettingsClient
      mutedKinds={mutedKinds}
      isAdmin={profile.role === "admin"}
    />
  );
}
