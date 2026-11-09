"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_ICAL_SETTING_KEY,
  HONEYBOOK_ICAL_SETTING_KEY,
} from "@/lib/calendar/events";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: "You must be signed in." as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { supabase, error: "Only admins can update calendar settings." as const };
  }

  return { supabase, error: null };
}

function validateIcalUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Paste an iCal URL (https://…).";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "URL must start with https://";
    }
  } catch {
    return "That doesn’t look like a valid URL.";
  }
  return null;
}

export async function saveCompanyIcalUrlAction(
  url: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const invalid = validateIcalUrl(url);
  if (invalid) {
    return {
      error:
        invalid === "Paste an iCal URL (https://…)."
                  ? "Paste the company iCal URL."
                  : invalid,
    };
  }
  const trimmed = url.trim();

  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      key: COMPANY_ICAL_SETTING_KEY,
      value: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (upsertError) return { error: upsertError.message };

  revalidateTag("company-ical", "max");
  revalidatePath("/calendar");
  return { error: null };
}

export async function clearCompanyIcalUrlAction(): Promise<{
  error: string | null;
}> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from("app_settings")
    .delete()
    .eq("key", COMPANY_ICAL_SETTING_KEY);

  if (deleteError) return { error: deleteError.message };

  revalidateTag("company-ical", "max");
  revalidatePath("/calendar");
  return { error: null };
}

export async function saveHoneybookIcalUrlAction(
  url: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const invalid = validateIcalUrl(url);
  if (invalid) return { error: invalid };
  const trimmed = url.trim();

  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      key: HONEYBOOK_ICAL_SETTING_KEY,
      value: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (upsertError) return { error: upsertError.message };

  // Keep legacy company_ical_url in sync so Event Packets / My Week / Teams
  // that still read the company key get the same HoneyBook feed.
  await supabase.from("app_settings").upsert(
    {
      key: COMPANY_ICAL_SETTING_KEY,
      value: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  revalidateTag("honeybook-ical", "max");
  revalidateTag("company-ical", "max");
  revalidateTag("djep-ical", "max");
  revalidatePath("/calendar");
  revalidatePath("/my-week");
  revalidatePath("/teams");
  return { error: null };
}

export async function clearHoneybookIcalUrlAction(): Promise<{
  error: string | null;
}> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from("app_settings")
    .delete()
    .eq("key", HONEYBOOK_ICAL_SETTING_KEY);

  if (deleteError) return { error: deleteError.message };

  // Clear the mirrored company key when it matches HoneyBook-only setup.
  await supabase
    .from("app_settings")
    .delete()
    .eq("key", COMPANY_ICAL_SETTING_KEY);

  revalidateTag("honeybook-ical", "max");
  revalidateTag("company-ical", "max");
  revalidateTag("djep-ical", "max");
  revalidatePath("/calendar");
  revalidatePath("/my-week");
  revalidatePath("/teams");
  return { error: null };
}

async function requireAssigner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, error: "You must be signed in." as const };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    return {
      supabase,
      user: null,
      error: "Only admins and trainers can assign staff." as const,
    };
  }
  return { supabase, user, error: null };
}

/** Replace Hub staff assignments for a calendar event uid. */
export async function saveEventAssignmentsAction(input: {
  eventUid: string;
  profileIds: string[];
}): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAssigner();
  if (error || !user) return { error: error ?? "You must be signed in." };

  const eventUid = input.eventUid.trim();
  if (!eventUid) return { error: "Missing event id." };

  const profileIds = Array.from(
    new Set((input.profileIds ?? []).map((id) => id.trim()).filter(Boolean)),
  );

  const { error: deleteError } = await supabase
    .from("calendar_event_assignments")
    .delete()
    .eq("event_uid", eventUid);
  if (deleteError) return { error: deleteError.message };

  if (profileIds.length) {
    const { error: insertError } = await supabase
      .from("calendar_event_assignments")
      .insert(
        profileIds.map((profile_id) => ({
          event_uid: eventUid,
          profile_id,
          created_by: user.id,
        })),
      );
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/calendar");
  return { error: null };
}
