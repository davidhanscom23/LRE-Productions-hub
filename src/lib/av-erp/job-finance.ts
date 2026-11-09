import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeOpportunityPrices } from "@/lib/av-erp/pricing";
import { jobMargin, resolveJobRevenue, roundMoney } from "@/lib/av-erp/margin";

export type JobFinanceSummary = {
  opportunityId: string;
  reference: string;
  subject: string;
  status: string;
  revenue: number;
  revenueSource: "invoices" | "quote";
  costs: number;
  margin: number;
  marginPct: number | null;
  realTotal: number;
};

type OppFinanceRow = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  surcharge_pct: number | null;
  discount_pct: number | null;
  venue_markup_pct: number | null;
  venue_markup_enabled: boolean | null;
};

function summarizeOpportunity(
  opp: OppFinanceRow,
  lines: { qty: number; unit_price: number; discount_pct: number }[],
  invoiceTotals: number[],
  costAmounts: number[],
): JobFinanceSummary {
  const prices = computeOpportunityPrices({
    lines: lines.map((l) => ({
      qty: Number(l.qty) || 0,
      unitPrice: Number(l.unit_price) || 0,
      discountPct: Number(l.discount_pct) || 0,
    })),
    surchargePct: Number(opp.surcharge_pct) || 0,
    discountPct: Number(opp.discount_pct) || 0,
    venueMarkupPct: Number(opp.venue_markup_pct) || 0,
    venueMarkupEnabled: Boolean(opp.venue_markup_enabled),
  });

  const { revenue, source } = resolveJobRevenue({
    invoiceTotals,
    quoteCustomerTotal: prices.customerTotal,
  });
  const costs = roundMoney(
    costAmounts.reduce((s, n) => s + (Number(n) || 0), 0),
  );
  const { margin, marginPct } = jobMargin({ revenue, costs });

  return {
    opportunityId: opp.id,
    reference: opp.reference,
    subject: opp.subject || "Untitled",
    status: opp.status,
    revenue,
    revenueSource: source,
    costs,
    margin,
    marginPct,
    realTotal: prices.realTotal,
  };
}

export async function loadJobFinanceForOpportunity(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<JobFinanceSummary | null> {
  const { data: opp, error } = await supabase
    .from("av_opportunities")
    .select(
      "id, reference, subject, status, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled",
    )
    .eq("id", opportunityId)
    .maybeSingle();
  if (error || !opp) return null;

  const [linesRes, invRes, costsRes] = await Promise.all([
    supabase
      .from("av_opportunity_lines")
      .select("qty, unit_price, discount_pct")
      .eq("opportunity_id", opportunityId),
    supabase
      .from("av_invoices")
      .select("total, status")
      .eq("opportunity_id", opportunityId)
      .neq("status", "void"),
    supabase
      .from("av_job_costs")
      .select("amount")
      .eq("opportunity_id", opportunityId),
  ]);

  return summarizeOpportunity(
    opp as OppFinanceRow,
    (linesRes.data ?? []) as {
      qty: number;
      unit_price: number;
      discount_pct: number;
    }[],
    (invRes.data ?? []).map((i) => Number(i.total) || 0),
    (costsRes.data ?? []).map((c) => Number(c.amount) || 0),
  );
}

/**
 * Costs board: one query for open jobs + three batched child queries
 * (not N+1 per opportunity — that made Costs/Reports feel stuck).
 */
export async function loadCostsBoard(
  supabase: SupabaseClient,
): Promise<JobFinanceSummary[]> {
  const { data: opps, error } = await supabase
    .from("av_opportunities")
    .select(
      "id, reference, subject, status, surcharge_pct, discount_pct, venue_markup_pct, venue_markup_enabled",
    )
    .in("status", ["draft", "quotation", "order"])
    .order("reference");
  if (error) throw new Error(error.message);
  if (!opps?.length) return [];

  const ids = opps.map((o) => o.id as string);
  const [linesRes, invRes, costsRes] = await Promise.all([
    supabase
      .from("av_opportunity_lines")
      .select("opportunity_id, qty, unit_price, discount_pct")
      .in("opportunity_id", ids),
    supabase
      .from("av_invoices")
      .select("opportunity_id, total, status")
      .in("opportunity_id", ids)
      .neq("status", "void"),
    supabase
      .from("av_job_costs")
      .select("opportunity_id, amount")
      .in("opportunity_id", ids),
  ]);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (invRes.error) throw new Error(invRes.error.message);
  if (costsRes.error) throw new Error(costsRes.error.message);

  const linesByOpp = new Map<
    string,
    { qty: number; unit_price: number; discount_pct: number }[]
  >();
  for (const row of linesRes.data ?? []) {
    const oid = row.opportunity_id as string;
    const list = linesByOpp.get(oid) ?? [];
    list.push({
      qty: Number(row.qty) || 0,
      unit_price: Number(row.unit_price) || 0,
      discount_pct: Number(row.discount_pct) || 0,
    });
    linesByOpp.set(oid, list);
  }

  const invByOpp = new Map<string, number[]>();
  for (const row of invRes.data ?? []) {
    const oid = row.opportunity_id as string;
    const list = invByOpp.get(oid) ?? [];
    list.push(Number(row.total) || 0);
    invByOpp.set(oid, list);
  }

  const costsByOpp = new Map<string, number[]>();
  for (const row of costsRes.data ?? []) {
    const oid = row.opportunity_id as string;
    const list = costsByOpp.get(oid) ?? [];
    list.push(Number(row.amount) || 0);
    costsByOpp.set(oid, list);
  }

  const rows: JobFinanceSummary[] = [];
  for (const opp of opps) {
    const summary = summarizeOpportunity(
      opp as OppFinanceRow,
      linesByOpp.get(opp.id as string) ?? [],
      invByOpp.get(opp.id as string) ?? [],
      costsByOpp.get(opp.id as string) ?? [],
    );
    if (summary.costs > 0 || summary.revenue > 0) rows.push(summary);
  }
  rows.sort((a, b) => a.reference.localeCompare(b.reference));
  return rows;
}
