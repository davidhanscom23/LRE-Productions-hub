"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { insertNotifications } from "@/lib/notifications/notify";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function canPost(role: string | undefined): boolean {
  return role === "admin" || role === "trainer";
}

export async function postAnnouncementAction(input: {
  title: string;
  body: string;
  requiresAck: boolean;
  expiresAt: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!canPost(profile.role)) {
    return { error: "Only admins and trainers can post announcements." };
  }
  const title = input.title?.trim();
  if (!title) return { error: "Give the announcement a title." };
  const expiresAt = ISO_DATE.test(input.expiresAt?.trim() ?? "")
    ? input.expiresAt.trim()
    : null;

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title: title.slice(0, 300),
    body: (input.body ?? "").trim().slice(0, 8000),
    requires_ack: Boolean(input.requiresAck),
    created_by: profile.id,
    expires_at: expiresAt,
  });
  if (error) return { error: error.message };

  // Notify all active staff (poster is admin/trainer, allowed to insert).
  try {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("is_active", true);
    const rows = (people ?? [])
      .filter((p) => p.role !== "guest" && p.id !== profile.id)
      .map((p) => ({
        userId: p.id as string,
        kind: "announcement",
        title: "New announcement",
        body: title,
        href: "/announcements",
      }));
    await insertNotifications(supabase, rows);
  } catch {
    // non-critical
  }

  revalidatePath("/announcements");
  revalidatePath("/");
  return { error: null };
}

export async function deleteAnnouncementAction(id: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!canPost(profile.role)) return { error: "Not allowed." };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/announcements");
  revalidatePath("/");
  return { error: null };
}

export async function acknowledgeAnnouncementAction(
  announcementId: string,
): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const supabase = await createClient();
  const { data: announcement } = await supabase
    .from("announcements")
    .select("id, requires_ack")
    .eq("id", announcementId)
    .maybeSingle();

  const { error } = await supabase
    .from("announcement_acks")
    .upsert(
      { announcement_id: announcementId, user_id: profile.id },
      { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
    );
  if (error) return { error: error.message };

  if (announcement?.requires_ack) {
    try {
      const { awardAchievement } = await import("@/lib/points/hub-points");
      await awardAchievement(supabase, "announcement_ack", {
        announcement_id: announcementId,
      });
    } catch {
      // non-critical
    }
  }

  revalidatePath("/announcements");
  revalidatePath("/");
  return { error: null };
}
