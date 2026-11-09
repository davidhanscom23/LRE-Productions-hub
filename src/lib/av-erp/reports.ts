import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AV_ERP_TIME_ZONE,
  datetimeLocalEasternToIso,
} from "@/lib/av-erp/datetime";
import { loadCostsBoard, type JobFinanceSummary } from "@/lib/av-erp/job-finance";
import { invoiceOutstanding } from "@/lib/av-erp/invoicing";
import { loadActivities, loadGearJobs } from "@/lib/av-erp/ops-data";
import type { ActivityRow } from "@/lib/av-erp/ops-data";
import type { GearJobWindow } from "@/lib/av-erp/ops-schedule";
import {
  aggregateCostsByCategory,
  filterCostsByCategory,
  filterSalesStock,
  filterSubContractCosts,
  invoiceAgingBucket,
  isLowStock,
  neverBookedProducts,
  partiallyInvoicedJobs,
  type CostCategoryTotal,
  type CostDetailRow,
  type InvoiceAgingBucketId,
  type PartialInvoiceJobInput,
} from "@/lib/av-erp/report-helpers";
import {
  aggregateCustomerIncome,
  aggregateNamedIncome,
  buildContactRows,
  buildTextItemRows,
  filterTextRentals,
  filterTextSales,
  type ContactReportRow,
  type CustomerIncomeRow,
  type IncomeNameRow,
  type TextItemRow,
} from "@/lib/av-erp/report-income";
import {
  loadStockRows,
  loadWarehouseBoard,
  type StockRow,
  type WarehouseCheckoutRow,
  type WarehouseStillOutRow,
} from "@/lib/av-erp/warehouse-data";
import type {
  AvBookingStatus,
  AvInvoiceStatus,
  AvOpportunityStatus,
} from "@/lib/av-erp/types";

export type OpenArRow = {
  id: string;
  reference: string;
  opportunityId: string | null;
  opportunityReference: string | null;
  customerName: string | null;
  subject: string;
  status: AvInvoiceStatus;
  total: number;
  amountPaid: number;
  outstanding: number;
  dueAt: string | null;
  agingBucket: InvoiceAgingBucketId;
};

export type CrewUpcomingRow = {
  id: string;
  opportunityId: string;
  opportunityReference: string;
  personName: string;
  roleLabel: string;
  startsAt: string;
  endsAt: string;
  dayRate: number | null;
  status: AvBookingStatus;
};

export type PipelineJobRow = {
  id: string;
  reference: string;
  subject: string;
  status: AvOpportunityStatus;
  customerName: string | null;
  gearStartsAt: string | null;
  gearEndsAt: string | null;
};

export type AgingSummaryRow = {
  bucket: InvoiceAgingBucketId;
  count: number;
  outstanding: number;
};

export type PaymentLedgerRow = {
  id: string;
  receivedAt: string;
  amount: number;
  method: string;
  reference: string;
  invoiceId: string;
  invoiceReference: string;
  customerName: string | null;
};

export type StockTxnRow = {
  id: string;
  movedAt: string;
  direction: string;
  qty: number;
  productName: string;
  productCode: string;
  opportunityReference: string | null;
  serial: string | null;
};

export type AvReportsBundle = {
  customerIncome: CustomerIncomeRow[];
  rentalIncome: IncomeNameRow[];
  saleIncome: IncomeNameRow[];
  serviceIncome: IncomeNameRow[];
  textRentals: TextItemRow[];
  textSales: TextItemRow[];
  contacts: ContactReportRow[];
  profit: JobFinanceSummary[];
  openAr: OpenArRow[];
  aging: AgingSummaryRow[];
  payments: PaymentLedgerRow[];
  partiallyInvoiced: PartialInvoiceJobInput[];
  gearOut: WarehouseStillOutRow[];
  overdueGear: WarehouseStillOutRow[];
  checkoutReady: WarehouseCheckoutRow[];
  crewUpcoming: CrewUpcomingRow[];
  pipeline: PipelineJobRow[];
  pipelineByStatus: Record<AvOpportunityStatus, number>;
  costsByCategory: CostCategoryTotal[];
  subRentBySupplier: { supplierName: string; total: number; count: number }[];
  oppSubRents: CostDetailRow[];
  subContracts: CostDetailRow[];
  lowStock: StockRow[];
  salesStock: StockRow[];
  neverBooked: StockRow[];
  stockTxns: StockTxnRow[];
  activitiesOpen: ActivityRow[];
  travelWindows: GearJobWindow[];
};

function startOfTodayEasternIso(): string {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: AV_ERP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    datetimeLocalEasternToIso(`${ymd}T00:00`) ??
    new Date(`${ymd}T04:00:00.000Z`).toISOString()
  );
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export async function loadAvReports(
  supabase: SupabaseClient,
): Promise<AvReportsBundle> {
  const since = startOfTodayEasternIso();
  const horizon = addDaysIso(since, 14);
  const nowMs = Date.now();

  const [
    profit,
    warehouse,
    stock,
    activities,
    gearJobs,
    invRes,
    bookingsRes,
    costsRes,
    oppsRes,
    incomeOppsRes,
    customersRes,
    venuesRes,
    paymentsRes,
    movementsRes,
  ] = await Promise.all([
    loadCostsBoard(supabase),
    loadWarehouseBoard(supabase),
    loadStockRows(supabase),
    loadActivities(supabase, { includeSettled: false }),
    loadGearJobs(supabase),
    supabase
      .from("av_invoices")
      .select(
        "id, reference, opportunity_id, subject, status, total, amount_paid, amount_credited, due_at, customer_id, av_customers ( name ), av_opportunities ( reference )",
      )
      .neq("status", "void")
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("av_contractor_bookings")
      .select(
        "id, opportunity_id, role_label, starts_at, ends_at, day_rate, status, profiles!av_contractor_bookings_profile_id_fkey ( full_name, email ), av_opportunities!av_contractor_bookings_opportunity_id_fkey ( reference )",
      )
      .gte("starts_at", since)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true }),
    supabase
      .from("av_job_costs")
      .select(
        "id, opportunity_id, category, amount, description, cost_date, supplier_id, av_suppliers ( name ), av_opportunities ( reference )",
      )
      .order("cost_date", { ascending: false }),
    supabase
      .from("av_opportunities")
      .select(
        "id, reference, subject, status, gear_starts_at, gear_ends_at, av_customers ( name )",
      )
      .in("status", ["draft", "quotation", "order"])
      .order("reference", { ascending: true }),
    supabase
      .from("av_opportunities")
      .select("id, reference, status")
      .in("status", ["quotation", "order", "closed"]),
    supabase
      .from("av_customers")
      .select("id, name, contact_name, email, phone")
      .eq("is_retired", false)
      .order("name", { ascending: true }),
    supabase
      .from("av_job_venues")
      .select("id, name, contact_name, email, phone")
      .eq("is_retired", false)
      .order("name", { ascending: true }),
    supabase
      .from("av_payments")
      .select(
        "id, amount, received_at, method, reference, invoice_id, av_invoices ( id, reference, customer_id, av_customers ( name ) )",
      )
      .order("received_at", { ascending: false })
      .limit(500),
    supabase
      .from("av_gear_movements")
      .select(
        "id, direction, qty, moved_at, product_id, opportunity_id, av_products ( name, code ), av_opportunities ( reference )",
      )
      .order("moved_at", { ascending: false })
      .limit(500),
  ]);

  if (invRes.error) throw new Error(invRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (costsRes.error) throw new Error(costsRes.error.message);
  if (oppsRes.error) throw new Error(oppsRes.error.message);
  if (incomeOppsRes.error) throw new Error(incomeOppsRes.error.message);
  if (customersRes.error) throw new Error(customersRes.error.message);
  if (venuesRes.error) throw new Error(venuesRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (movementsRes.error) throw new Error(movementsRes.error.message);

  const incomeOppIds = (incomeOppsRes.data ?? []).map((r) => r.id as string);
  const incomeOppById = new Map(
    (incomeOppsRes.data ?? []).map((r) => [
      r.id as string,
      { reference: r.reference as string, status: r.status as string },
    ]),
  );
  const incomeLinesRes =
    incomeOppIds.length === 0
      ? { data: [] as Record<string, unknown>[], error: null }
      : await supabase
          .from("av_opportunity_lines")
          .select(
            "id, opportunity_id, product_id, service_id, description, qty, unit_price, discount_pct, text_kind, av_products ( id, name, code, kind ), av_services ( id, name, code )",
          )
          .in("opportunity_id", incomeOppIds);
  if (incomeLinesRes.error) throw new Error(incomeLinesRes.error.message);

  const openAr: OpenArRow[] = [];
  for (const row of invRes.data ?? []) {
    const total = Number(row.total) || 0;
    const amountPaid = Number(row.amount_paid) || 0;
    const amountCredited = Number(row.amount_credited) || 0;
    const outstanding = invoiceOutstanding(total, amountPaid, amountCredited);
    if (outstanding <= 0) continue;
    const cust = row.av_customers as
      | { name: string }
      | { name: string }[]
      | null;
    const opp = row.av_opportunities as
      | { reference: string }
      | { reference: string }[]
      | null;
    const c = Array.isArray(cust) ? cust[0] : cust;
    const o = Array.isArray(opp) ? opp[0] : opp;
    const dueAt = (row.due_at as string | null) ?? null;
    openAr.push({
      id: row.id as string,
      reference: row.reference as string,
      opportunityId: (row.opportunity_id as string | null) ?? null,
      opportunityReference: o?.reference ?? null,
      customerName: c?.name ?? null,
      subject: (row.subject as string) || "",
      status: row.status as AvInvoiceStatus,
      total,
      amountPaid,
      outstanding,
      dueAt,
      agingBucket: invoiceAgingBucket(dueAt, nowMs),
    });
  }

  const agingMap = new Map<
    InvoiceAgingBucketId,
    { count: number; outstanding: number }
  >();
  for (const row of openAr) {
    const cur = agingMap.get(row.agingBucket) ?? {
      count: 0,
      outstanding: 0,
    };
    cur.count += 1;
    cur.outstanding += row.outstanding;
    agingMap.set(row.agingBucket, cur);
  }
  const aging: AgingSummaryRow[] = (
    ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as InvoiceAgingBucketId[]
  )
    .map((bucket) => {
      const cur = agingMap.get(bucket) ?? { count: 0, outstanding: 0 };
      return {
        bucket,
        count: cur.count,
        outstanding: Math.round((cur.outstanding + Number.EPSILON) * 100) / 100,
      };
    })
    .filter((r) => r.count > 0);

  const crewUpcoming: CrewUpcomingRow[] = (bookingsRes.data ?? []).map(
    (row) => {
      const person = row.profiles as
        | { full_name: string | null; email: string | null }
        | { full_name: string | null; email: string | null }[]
        | null;
      const opp = row.av_opportunities as
        | { reference: string }
        | { reference: string }[]
        | null;
      const p = Array.isArray(person) ? person[0] : person;
      const o = Array.isArray(opp) ? opp[0] : opp;
      return {
        id: row.id as string,
        opportunityId: row.opportunity_id as string,
        opportunityReference: o?.reference ?? "—",
        personName: p?.full_name || p?.email || "Unknown",
        roleLabel: (row.role_label as string) || "",
        startsAt: row.starts_at as string,
        endsAt: row.ends_at as string,
        dayRate: row.day_rate == null ? null : Number(row.day_rate),
        status: row.status as AvBookingStatus,
      };
    },
  );

  const pipelineByStatus: Record<AvOpportunityStatus, number> = {
    draft: 0,
    quotation: 0,
    order: 0,
    closed: 0,
  };
  const pipeline: PipelineJobRow[] = (oppsRes.data ?? []).map((row) => {
    const status = row.status as AvOpportunityStatus;
    if (status in pipelineByStatus) pipelineByStatus[status] += 1;
    const cust = row.av_customers as
      | { name: string }
      | { name: string }[]
      | null;
    const c = Array.isArray(cust) ? cust[0] : cust;
    return {
      id: row.id as string,
      reference: row.reference as string,
      subject: (row.subject as string) || "Untitled",
      status,
      customerName: c?.name ?? null,
      gearStartsAt: (row.gear_starts_at as string | null) ?? null,
      gearEndsAt: (row.gear_ends_at as string | null) ?? null,
    };
  });

  const costDetails: CostDetailRow[] = (costsRes.data ?? []).map((r) => {
    const supplier = r.av_suppliers as
      | { name: string }
      | { name: string }[]
      | null;
    const opp = r.av_opportunities as
      | { reference: string }
      | { reference: string }[]
      | null;
    const s = Array.isArray(supplier) ? supplier[0] : supplier;
    const o = Array.isArray(opp) ? opp[0] : opp;
    return {
      id: r.id as string,
      opportunityId: r.opportunity_id as string,
      opportunityReference: o?.reference ?? "—",
      category: (r.category as string) || "other",
      amount: Number(r.amount) || 0,
      taxAmount: Number((r as { tax_amount?: number }).tax_amount) || 0,
      supplierName: s?.name ?? null,
      description: (r.description as string) || "",
      costDate: (r.cost_date as string) || "",
    };
  });

  const costsByCategory = aggregateCostsByCategory(
    costDetails.map((r) => ({
      category: r.category,
      amount: r.amount + r.taxAmount,
    })),
  );

  const subHireRows = filterCostsByCategory(costDetails, "sub_hire");
  const subRentBySupplierMap = new Map<
    string,
    { supplierName: string; total: number; count: number }
  >();
  for (const row of subHireRows) {
    const key = row.supplierName?.trim() || "No supplier";
    const cur = subRentBySupplierMap.get(key) ?? {
      supplierName: key,
      total: 0,
      count: 0,
    };
    cur.total =
      Math.round((cur.total + row.amount + row.taxAmount + Number.EPSILON) * 100) /
      100;
    cur.count += 1;
    subRentBySupplierMap.set(key, cur);
  }
  const subRentBySupplier = [...subRentBySupplierMap.values()].sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName),
  );
  const oppSubRents = subHireRows;
  const subContracts = filterSubContractCosts(costDetails);

  const payments: PaymentLedgerRow[] = (paymentsRes.data ?? []).map((row) => {
    const inv = row.av_invoices as
      | {
          id: string;
          reference: string;
          av_customers: { name: string } | { name: string }[] | null;
        }
      | {
          id: string;
          reference: string;
          av_customers: { name: string } | { name: string }[] | null;
        }[]
      | null;
    const i = Array.isArray(inv) ? inv[0] : inv;
    const cust = i?.av_customers;
    const c = Array.isArray(cust) ? cust[0] : cust;
    return {
      id: row.id as string,
      receivedAt: row.received_at as string,
      amount: Number(row.amount) || 0,
      method: (row.method as string) || "",
      reference: (row.reference as string) || "",
      invoiceId: (i?.id as string) || (row.invoice_id as string),
      invoiceReference: i?.reference ?? "—",
      customerName: c?.name ?? null,
    };
  });

  const stockTxns: StockTxnRow[] = (movementsRes.data ?? []).map((row) => {
    const product = row.av_products as
      | { name: string; code: string }
      | { name: string; code: string }[]
      | null;
    const opp = row.av_opportunities as
      | { reference: string }
      | { reference: string }[]
      | null;
    const p = Array.isArray(product) ? product[0] : product;
    const o = Array.isArray(opp) ? opp[0] : opp;
    return {
      id: row.id as string,
      movedAt: row.moved_at as string,
      direction: row.direction as string,
      qty: Number(row.qty) || 0,
      productName: p?.name ?? "—",
      productCode: p?.code ?? "",
      opportunityReference: o?.reference ?? null,
      serial: null,
    };
  });

  const lowStock = stock.filter((r) => isLowStock(r, 0));
  const salesStock = filterSalesStock(stock);

  const travelWindows = gearJobs.filter((job) => {
    const start = new Date(job.gearStartsAt).getTime();
    const end = new Date(job.gearEndsAt).getTime();
    const from = new Date(since).getTime();
    const to = new Date(horizon).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return end >= from && start <= to;
  });

  const customerIncome = aggregateCustomerIncome(
    (invRes.data ?? []).map((row) => {
      const cust = row.av_customers as
        | { name: string }
        | { name: string }[]
        | null;
      const c = Array.isArray(cust) ? cust[0] : cust;
      return {
        customerId: (row.customer_id as string | null) ?? null,
        customerName: c?.name ?? null,
        total: Number(row.total) || 0,
      };
    }),
  );

  const rentalLines: {
    id: string;
    name: string;
    code?: string | null;
    qty: number;
    unitPrice: number;
    discountPct: number;
  }[] = [];
  const saleLines: typeof rentalLines = [];
  const serviceLines: typeof rentalLines = [];
  const textRaw: {
    lineId: string;
    opportunityId: string;
    opportunityReference: string;
    description: string;
    qty: number;
    unitPrice: number;
    discountPct: number;
    textKind: string | null;
  }[] = [];

  for (const row of incomeLinesRes.data ?? []) {
    const product = row.av_products as
      | { id: string; name: string; code: string; kind: string }
      | { id: string; name: string; code: string; kind: string }[]
      | null;
    const service = row.av_services as
      | { id: string; name: string; code: string }
      | { id: string; name: string; code: string }[]
      | null;
    const p = Array.isArray(product) ? product[0] : product;
    const s = Array.isArray(service) ? service[0] : service;
    const qty = Number(row.qty) || 0;
    const unitPrice = Number(row.unit_price) || 0;
    const discountPct = Number(row.discount_pct) || 0;
    const opportunityId = row.opportunity_id as string;
    const oppMeta = incomeOppById.get(opportunityId);

    if (p?.id) {
      const named = {
        id: p.id,
        name: p.name,
        code: p.code || null,
        qty,
        unitPrice,
        discountPct,
      };
      if (p.kind === "rental" || p.kind === "package") {
        rentalLines.push(named);
      } else if (p.kind === "sale" || p.kind === "consumable") {
        saleLines.push(named);
      }
      continue;
    }
    if (s?.id) {
      serviceLines.push({
        id: s.id,
        name: s.name,
        code: s.code || null,
        qty,
        unitPrice,
        discountPct,
      });
      continue;
    }
    textRaw.push({
      lineId: row.id as string,
      opportunityId,
      opportunityReference: oppMeta?.reference ?? "—",
      description: (row.description as string) || "",
      qty,
      unitPrice,
      discountPct,
      textKind: (row.text_kind as string | null) ?? null,
    });
  }

  const allTextItems = buildTextItemRows(textRaw);

  const bookedProductIds = new Set<string>();
  for (const row of incomeLinesRes.data ?? []) {
    const product = row.av_products as
      | { id: string }
      | { id: string }[]
      | null;
    const p = Array.isArray(product) ? product[0] : product;
    if (p?.id) bookedProductIds.add(p.id);
  }
  const neverBooked = neverBookedProducts(
    stock.map((s) => ({ ...s, productId: s.productId, isActive: true })),
    bookedProductIds,
  );

  const invoiceByOpp = new Map<
    string,
    { total: number; statuses: string[]; subject: string; reference: string }
  >();
  for (const row of invRes.data ?? []) {
    const oppId = row.opportunity_id as string | null;
    if (!oppId) continue;
    const cur = invoiceByOpp.get(oppId) ?? {
      total: 0,
      statuses: [] as string[],
      subject: "",
      reference: "",
    };
    cur.total += Number(row.total) || 0;
    cur.statuses.push(row.status as string);
    invoiceByOpp.set(oppId, cur);
  }
  const partiallyInvoiced = partiallyInvoicedJobs(
    profit
      .filter((p) => invoiceByOpp.has(p.opportunityId))
      .map((p) => {
        const inv = invoiceByOpp.get(p.opportunityId)!;
        return {
          opportunityId: p.opportunityId,
          reference: p.reference,
          subject: p.subject,
          quoteCustomerTotal: p.realTotal,
          invoiceTotal: inv.total,
          invoiceStatuses: inv.statuses,
        };
      }),
  );

  return {
    customerIncome,
    rentalIncome: aggregateNamedIncome(rentalLines),
    saleIncome: aggregateNamedIncome(saleLines),
    serviceIncome: aggregateNamedIncome(serviceLines),
    textRentals: filterTextRentals(allTextItems),
    textSales: filterTextSales(allTextItems),
    contacts: buildContactRows(
      (customersRes.data ?? []) as {
        id: string;
        name: string;
        contact_name: string;
        email: string;
        phone: string;
      }[],
      (venuesRes.data ?? []) as {
        id: string;
        name: string;
        contact_name: string;
        email: string;
        phone: string;
      }[],
    ),
    profit,
    openAr,
    aging,
    payments,
    partiallyInvoiced,
    gearOut: warehouse.stillOut,
    overdueGear: warehouse.stillOut.filter((r) => r.overdue),
    checkoutReady: warehouse.checkoutReady,
    crewUpcoming,
    pipeline,
    pipelineByStatus,
    costsByCategory,
    subRentBySupplier,
    oppSubRents,
    subContracts,
    lowStock,
    salesStock,
    neverBooked,
    stockTxns,
    activitiesOpen: activities,
    travelWindows,
  };
}
