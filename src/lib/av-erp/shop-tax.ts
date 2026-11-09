import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const AV_DEFAULT_SALES_TAX_SETTING_KEY = "av_default_sales_tax_rate_pct";

/** Read shop default sales tax % from app_settings (0 if missing). */
export async function loadShopDefaultSalesTaxRatePct(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", AV_DEFAULT_SALES_TAX_SETTING_KEY)
    .maybeSingle();
  if (error || !data) return 0;
  const n = Number(String(data.value ?? "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export async function saveShopDefaultSalesTaxRatePct(
  supabase: SupabaseClient,
  ratePct: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rate = Math.max(0, Math.min(100, Number(ratePct) || 0));
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: AV_DEFAULT_SALES_TAX_SETTING_KEY,
      value: String(rate),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
