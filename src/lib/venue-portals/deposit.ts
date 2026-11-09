import { round2 } from "@/lib/venue-portals/pricing";

/** Book Now deposit from the customer-facing (post-discount) estimated total. */
export function depositAmount(estimatedTotal: number, depositPct: number): number {
  const total = Math.max(0, Number(estimatedTotal) || 0);
  const pct = Math.min(100, Math.max(0, Number(depositPct) || 0));
  return round2((total * pct) / 100);
}
