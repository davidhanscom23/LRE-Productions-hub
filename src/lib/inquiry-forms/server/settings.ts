import "server-only";

/**
 * Inquiry Forms - business settings (singleton inquiry_settings row id = 1).
 * Effective settings = DEFAULT_BUSINESS_SETTINGS <- HUB_BUSINESS_DEFAULTS (presets.ts) <- saved row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BUSINESS_SETTINGS, mergeBusinessSettings } from "../defaults";
import type { BusinessSettings } from "../types";
import { layerSettings } from "./bundle-core";
import { InquiryDbError } from "./db";
import { HUB_BUSINESS_DEFAULTS } from "./presets";
import { TABLES } from "./schema-core";

/** The hub's defaults with nothing saved yet (what a fresh install uses). */
export function hubBusinessDefaults(): BusinessSettings {
  return mergeBusinessSettings(layerSettings(DEFAULT_BUSINESS_SETTINGS, HUB_BUSINESS_DEFAULTS));
}

/** Effective business settings. Throws InquiryDbError when the row cannot be read. */
export async function getBusinessSettings(sb: SupabaseClient): Promise<BusinessSettings> {
  const { data, error } = await sb.from(TABLES.settings).select("business").eq("id", 1).maybeSingle();
  if (error) throw new InquiryDbError("load business settings", error.message);
  const saved = (data as { business?: unknown } | null)?.business ?? {};
  return mergeBusinessSettings(layerSettings(layerSettings(DEFAULT_BUSINESS_SETTINGS, HUB_BUSINESS_DEFAULTS), saved));
}

/**
 * Save business settings (normalized through mergeBusinessSettings first) and return what was
 * stored. Throws InquiryDbError when the write fails.
 */
export async function saveBusinessSettings(
  sb: SupabaseClient,
  s: BusinessSettings,
  userId: string | null,
): Promise<BusinessSettings> {
  const normalized = mergeBusinessSettings(layerSettings(hubBusinessDefaults(), s));
  const { error } = await sb.from(TABLES.settings).upsert(
    { id: 1, business: normalized, updated_at: new Date().toISOString(), updated_by: userId },
    { onConflict: "id" },
  );
  if (error) throw new InquiryDbError("save business settings", error.message);
  return normalized;
}
