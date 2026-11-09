"use server";

import { revalidatePath } from "next/cache";
import { getRealProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin only: hide a Changelog video from staff (superseded) or bring it back
 * (live). Hidden videos stay in the database and in the admin list.
 */
export async function setChangelogVideoStatusAction(formData: FormData): Promise<void> {
  const profile = await getRealProfile();
  if (!profile || profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || (status !== "live" && status !== "superseded")) return;

  const supabase = await createClient();
  await supabase
    .from("changelog_videos")
    .update(status === "live" ? { status, superseded_by: null } : { status })
    .eq("id", id);

  revalidatePath("/changelog");
  revalidatePath("/changelog/videos");
}
