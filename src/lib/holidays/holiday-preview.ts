import { createClient } from "@/lib/supabase/server";
import { isHolidayId, type HolidayId } from "@/lib/holidays/holidays";

/** app_settings key — value is a holiday id; empty / anything else = off. Admin-only read/write. */
export const HOLIDAY_PREVIEW_KEY = "holiday_preview";

/** The holiday an admin picked on Hub health to preview, or null when off. */
export async function getHolidayPreview(): Promise<HolidayId | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", HOLIDAY_PREVIEW_KEY)
      .maybeSingle();
    if (error) return null;
    const value = (data?.value ?? "").trim();
    return isHolidayId(value) ? value : null;
  } catch {
    return null;
  }
}

/** Only admins ever see the preview; staff and trainers are never affected. */
export async function adminHolidayPreview(
  role: string | null | undefined,
): Promise<HolidayId | null> {
  if (role !== "admin") return null;
  return getHolidayPreview();
}
