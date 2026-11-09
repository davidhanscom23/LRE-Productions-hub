import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isInvoiceOverdue } from "@/lib/av-erp/invoice-overdue";
import type { AvOpportunityStatus } from "@/lib/av-erp/types";
import {
  isOverdue,
  stillOutByKey,
  type GearMovementRow,
} from "@/lib/av-erp/warehouse";

export type HubOverviewUpcoming = {
  id: string;
  reference: string;
  subject: string;
  status: AvOpportunityStatus;
  gear_starts_at: string;
  customer_name: string | null;
};

export type HubOverviewStats = {
  byStatus: Record<AvOpportunityStatus, number>;
  openTotal: number;
  holdsCount: number;
  stillOutCount: number;
  overdueCount: number;
  activitiesDueToday: number;
  activitiesOverdue: number;
  openInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  upcoming: HubOverviewUpcoming[];
};

const EMPTY_STATUS: Record<AvOpportunityStatus, number> = {
  draft: 0,
  quotation: 0,
  order: 0,
  closed: 0,
};

export async function loadHubOverviewStats(
  supabase: SupabaseClient,
): Promise<HubOverviewStats> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [
    oppsRes,
    holdsRes,
    upcomingRes,
    movesRes,
    endsRes,
    activitiesRes,
    invoicesRes,
  ] = await Promise.all([
    supabase.from("av_opportunities").select("status"),
    supabase.from("av_holds").select("id", { count: "exact", head: true }),
    supabase
      .from("av_opportunities")
      .select(
        "id, reference, subject, status, gear_starts_at, av_customers ( name )",
      )
      .not("gear_starts_at", "is", null)
      .gte("gear_starts_at", now.toISOString())
      .lte("gear_starts_at", horizon.toISOString())
      .in("status", ["draft", "quotation", "order"])
      .order("gear_starts_at", { ascending: true })
      .limit(8),
    supabase
      .from("av_gear_movements")
      .select("opportunity_id, product_id, direction, qty"),
    supabase
      .from("av_opportunities")
      .select("id, gear_ends_at")
      .not("gear_ends_at", "is", null),
    supabase
      .from("av_activities")
      .select("due_at, settled_at")
      .is("settled_at", null),
    supabase
      .from("av_invoices")
      .select("status, due_at, total, amount_paid, amount_credited"),
  ]);

  const byStatus = { ...EMPTY_STATUS };
  for (const row of oppsRes.data ?? []) {
    const s = row.status as AvOpportunityStatus;
    if (s in byStatus) byStatus[s] += 1;
  }

  const upcoming: HubOverviewUpcoming[] = (upcomingRes.data ?? []).map(
    (row) => {
      const raw = row.av_customers as
        | { name: string }
        | { name: string }[]
        | null
        | undefined;
      const customer = Array.isArray(raw) ? raw[0] : raw;
      return {
        id: row.id as string,
        reference: row.reference as string,
        subject: (row.subject as string) || "Untitled",
        status: row.status as AvOpportunityStatus,
        gear_starts_at: row.gear_starts_at as string,
        customer_name: customer?.name ?? null,
      };
    },
  );

  let stillOutCount = 0;
  let overdueCount = 0;
  if (!movesRes.error && movesRes.data) {
    const still = stillOutByKey(movesRes.data as GearMovementRow[]);
    stillOutCount = still.size;
    const endsById = new Map(
      (endsRes.data ?? []).map((o) => [
        o.id as string,
        (o.gear_ends_at as string | null) ?? null,
      ]),
    );
    const nowMs = now.getTime();
    for (const [key, qty] of still) {
      const oppId = key.split("::")[0];
      if (isOverdue(qty, endsById.get(oppId) ?? null, nowMs)) {
        overdueCount += 1;
      }
    }
  }

  let activitiesDueToday = 0;
  let activitiesOverdue = 0;
  if (!activitiesRes.error && activitiesRes.data) {
    const tz = "America/New_York";
    const todayYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    for (const row of activitiesRes.data) {
      const due = new Date(row.due_at as string);
      if (Number.isNaN(due.getTime())) continue;
      const dueYmd = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(due);
      if (dueYmd === todayYmd) activitiesDueToday += 1;
      else if (due.getTime() < now.getTime() && dueYmd < todayYmd) {
        activitiesOverdue += 1;
      }
    }
  }

  let openInvoices = 0;
  let unpaidInvoices = 0;
  let overdueInvoices = 0;
  if (!invoicesRes.error && invoicesRes.data) {
    for (const inv of invoicesRes.data) {
      const status = inv.status as string;
      if (status === "void" || status === "paid") continue;
      openInvoices += 1;
      const total = Number(inv.total) || 0;
      const paid = Number(inv.amount_paid) || 0;
      const credited = Number(inv.amount_credited) || 0;
      if (total - paid - credited > 0.001) unpaidInvoices += 1;
      if (
        isInvoiceOverdue({
          status,
          dueAt: inv.due_at as string | null,
          total,
          amountPaid: paid,
          amountCredited: credited,
        })
      ) {
        overdueInvoices += 1;
      }
    }
  }

  return {
    byStatus,
    openTotal: byStatus.draft + byStatus.quotation + byStatus.order,
    holdsCount: holdsRes.count ?? 0,
    stillOutCount,
    overdueCount,
    activitiesDueToday,
    activitiesOverdue,
    openInvoices,
    unpaidInvoices,
    overdueInvoices,
    upcoming,
  };
}
