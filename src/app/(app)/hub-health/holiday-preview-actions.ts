"use server";

import { revalidatePath } from "next/cache";
import { HOLIDAY_PREVIEW_KEY } from "@/lib/holidays/holiday-preview";
import { isHolidayId } from "@/lib/holidays/holidays";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "You must be signed in." as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { supabase, error: "Only admins can preview holiday themes." as const };
  }

  return { supabase, error: null };
}

/** Pass a holiday id to preview it, or null to turn the preview off. */
export async function setHolidayPreviewAction(
  holiday: string | null,
): Promise<{ error: string | null }> {
  if (holiday !== null && !isHolidayId(holiday)) {
    return { error: "Unknown holiday." };
  }

  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      key: HOLIDAY_PREVIEW_KEY,
      value: holiday ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (upsertError) return { error: upsertError.message };

  revalidatePath("/", "layout");
  return { error: null };
}
