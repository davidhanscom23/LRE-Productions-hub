import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_ICAL_SETTING_KEY,
  WORK_ICAL_SETTING_KEY,
} from "@/lib/calendar/events";

/** Whether the company iCal URL is configured. Never returns the URL. */
export async function isCompanyIcalConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", COMPANY_ICAL_SETTING_KEY)
    .maybeSingle();

  return Boolean(data?.value?.trim());
}

/**
 * Server-only: load the legacy company iCal URL.
 * Do not pass the return value into client components or serialize it in props.
 */
export async function getCompanyIcalUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", COMPANY_ICAL_SETTING_KEY)
    .maybeSingle();

  const value = data?.value?.trim() ?? "";
  return value || null;
}

/** Whether a shared team iCal URL is configured. */
export async function isWorkIcalConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", WORK_ICAL_SETTING_KEY)
    .maybeSingle();

  return Boolean(data?.value?.trim());
}

/**
 * Server-only: shared team calendar iCal URL (usually Google Calendar secret ICS).
 * Do not pass into client components.
 */
export async function getWorkIcalUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", WORK_ICAL_SETTING_KEY)
    .maybeSingle();

  const value = data?.value?.trim() ?? "";
  return value || null;
}

/** Prefer the shared team iCal; fall back to legacy company_ical_url. */
export async function getSharedWorkIcalUrl(): Promise<string | null> {
  return (await getWorkIcalUrl()) || (await getCompanyIcalUrl());
}

/** True when any shared work calendar iCal is configured. */
export async function isSharedCalendarConfigured(): Promise<boolean> {
  return Boolean(await getSharedWorkIcalUrl());
}
