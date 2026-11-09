/** Confirmed crew × day_rate → labor job cost helpers (pure). */

import { AV_ERP_TIME_ZONE } from "@/lib/av-erp/datetime";
import { roundMoney } from "@/lib/av-erp/invoicing";
import type { AvBookingStatus } from "@/lib/av-erp/types";

/** Eastern calendar date `YYYY-MM-DD` for a timestamptz ISO string. */
export function easternYmdFromIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AV_ERP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Inclusive Eastern calendar days between start and end.
 * Same Eastern date → 1. Always at least 1 when both parse.
 */
export function crewBillableDays(
  startsAtIso: string,
  endsAtIso: string,
): number {
  const startYmd = easternYmdFromIso(startsAtIso);
  const endYmd = easternYmdFromIso(endsAtIso);
  if (!startYmd || !endYmd) return 1;
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  const days = Math.floor((endUtc - startUtc) / 86_400_000) + 1;
  return Math.max(1, days);
}

export function crewLaborCostAmount(
  dayRate: number | null | undefined,
  startsAtIso: string,
  endsAtIso: string,
): number | null {
  if (dayRate == null || !Number.isFinite(dayRate) || dayRate <= 0) {
    return null;
  }
  const days = crewBillableDays(startsAtIso, endsAtIso);
  return roundMoney(dayRate * days);
}

export function shouldSyncCrewLaborCost(input: {
  status: AvBookingStatus | string;
  dayRate: number | null | undefined;
  rollIntoCosts: boolean;
}): boolean {
  if (!input.rollIntoCosts) return false;
  if (input.status !== "confirmed") return false;
  return (
    input.dayRate != null &&
    Number.isFinite(input.dayRate) &&
    input.dayRate > 0
  );
}

export function crewLaborCostDescription(input: {
  personName: string;
  roleLabel: string;
  days: number;
  dayRate: number;
}): string {
  const name = input.personName.trim() || "Crew";
  const role = input.roleLabel.trim();
  const rate = roundMoney(input.dayRate).toFixed(2);
  const base = role
    ? `Crew: ${name} · ${role}`
    : `Crew: ${name}`;
  return `${base} (${input.days} day${input.days === 1 ? "" : "s"} × $${rate})`;
}
