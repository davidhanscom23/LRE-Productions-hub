import type { SupabaseClient } from "@supabase/supabase-js";

/** direct = LRE bills the client (23% surcharge shows); venue = the venue pays LRE and bills the client on its master bill. */
export type AvBillingType = "direct" | "venue";

export const AV_BILLING_LABELS: Record<AvBillingType, string> = {
  direct: "Direct (we bill the client)",
  venue: "Venue partner (venue pays us)",
};

/** Shown on estimates and invoices that go through a venue's master bill. */
export const VENUE_BILLING_NOTE =
  "If added to your master portfolio, the venue may add a service charge and taxes to your final bill for your AV.";

export function normalizeBillingType(value: unknown): AvBillingType {
  return value === "venue" ? "venue" : "direct";
}

/** Reads billing_type; before migration 187 is applied it quietly returns "direct". */
export async function loadBillingType(
  supabase: SupabaseClient,
  table: "av_opportunities" | "av_invoices",
  id: string | null | undefined,
): Promise<AvBillingType> {
  if (!id) return "direct";
  try {
    const { data, error } = await supabase.from(table).select("billing_type").eq("id", id).maybeSingle();
    if (error) return "direct";
    return normalizeBillingType((data as { billing_type?: string } | null)?.billing_type);
  } catch {
    return "direct";
  }
}
