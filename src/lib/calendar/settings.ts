import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_ICAL_SETTING_KEY,
  HONEYBOOK_ICAL_SETTING_KEY,
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

/** Whether a HoneyBook→Google (or similar) iCal URL is configured. */
export async function isHoneybookIcalConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", HONEYBOOK_ICAL_SETTING_KEY)
    .maybeSingle();

  return Boolean(data?.value?.trim());
}

/**
 * Server-only: HoneyBook calendar iCal URL (usually Google Calendar secret ICS).
 * Do not pass into client components.
 */
export async function getHoneybookIcalUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", HONEYBOOK_ICAL_SETTING_KEY)
    .maybeSingle();

  const value = data?.value?.trim() ?? "";
  return value || null;
}

/** Prefer HoneyBook Google iCal; fall back to legacy company_ical_url. */
export async function getSharedWorkIcalUrl(): Promise<string | null> {
  return (await getHoneybookIcalUrl()) || (await getCompanyIcalUrl());
}

/** True when any shared work calendar iCal is configured. */
export async function isSharedCalendarConfigured(): Promise<boolean> {
  return Boolean(await getSharedWorkIcalUrl());
}
