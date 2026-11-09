"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  MANDATORY_NOTIFICATION_KINDS,
  NOTIFICATION_KIND_SET,
} from "@/lib/notifications/kinds";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

export async function setNotificationMuteAction(input: {
  kind: string;
  muted: boolean;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!NOTIFICATION_KIND_SET.has(input.kind)) {
    return { error: "Unknown notification type." };
  }
  // Non-admins can't turn off admin-originated notifications.
  if (
    input.muted &&
    MANDATORY_NOTIFICATION_KINDS.has(input.kind) &&
    profile.role !== "admin"
  ) {
    return { error: "This notification type can’t be turned off." };
  }

  const supabase = await createClient();
  if (input.muted) {
    const { error } = await supabase.from("notification_mutes").upsert(
      { user_id: profile.id, kind: input.kind },
      { onConflict: "user_id,kind", ignoreDuplicates: true },
    );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("notification_mutes")
      .delete()
      .eq("user_id", profile.id)
      .eq("kind", input.kind);
    if (error) return { error: error.message };
  }

  revalidatePath("/notification-settings");
  return { error: null };
}
