"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export type HubNotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export async function listMyNotificationsAction(
  limit = 20,
): Promise<{ error: string | null; notifications: HubNotificationRow[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", notifications: [] };

  const { data, error } = await supabase
    .from("hub_notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Table may not exist until migration 032 is applied.
    return { error: null, notifications: [] };
  }

  return {
    error: null,
    notifications: (data ?? []).map((row) => ({
      id: row.id as string,
      kind: String(row.kind ?? ""),
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      href: String(row.href ?? ""),
      read_at: (row.read_at as string | null) ?? null,
      created_at: String(row.created_at ?? ""),
    })),
  };
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("hub_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return { error: null };
}

/** Flip a notification back to unread. */
export async function markNotificationUnreadAction(
  notificationId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("hub_notifications")
    .update({ read_at: null })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return { error: null };
}

/**
 * Delete one of the current user's notifications. There is no RLS delete policy
 * on hub_notifications, so this uses the service role but strictly filters by
 * user_id = the signed-in user, so a user can only delete their own.
 */
export async function deleteNotificationAction(
  notificationId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createServiceClient();
  const { error } = await admin
    .from("hub_notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return { error: null };
}

/** Delete all of the current user's read notifications (clear the read pile). */
export async function deleteReadNotificationsAction(): Promise<{
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createServiceClient();
  const { error } = await admin
    .from("hub_notifications")
    .delete()
    .eq("user_id", user.id)
    .not("read_at", "is", null);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return { error: null };
}

export async function markAllNotificationsReadAction(): Promise<{
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("hub_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  return { error: null };
}
