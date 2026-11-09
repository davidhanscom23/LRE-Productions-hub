/** Pure aggregators for KM income / text / contacts report sections. */

import { lineTotal } from "@/lib/av-erp/pricing";
import { roundMoney } from "@/lib/av-erp/margin";

export type IncomeNameRow = {
  id: string;
  name: string;
  code: string | null;
  lineCount: number;
  total: number;
};

export type CustomerIncomeRow = {
  customerId: string | null;
  customerName: string;
  invoiceCount: number;
  total: number;
};

export type TextItemKind = "rental" | "sale" | "untagged";

export type TextItemRow = {
  lineId: string;
  opportunityId: string;
  opportunityReference: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  /** Free-text rental/sale tag; untagged when null/unknown. */
  textKind: TextItemKind;
};

export type ContactReportRow = {
  id: string;
  kind: "customer" | "venue";
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
};

export function lineAmount(input: {
  qty: number;
  unitPrice: number;
  discountPct: number;
}): number {
  return lineTotal({
    qty: input.qty,
    unitPrice: input.unitPrice,
    discountPct: input.discountPct,
  });
}

/** Roll invoice totals by customer (non-void already filtered by caller). */
export function aggregateCustomerIncome(
  rows: {
    customerId: string | null;
    customerName: string | null;
    total: number;
  }[],
): CustomerIncomeRow[] {
  const map = new Map<
    string,
    { customerId: string | null; customerName: string; invoiceCount: number; total: number }
  >();
  for (const row of rows) {
    const key = row.customerId ?? `name:${(row.customerName ?? "").trim() || "—"}`;
    const name = (row.customerName ?? "").trim() || "No customer";
    const cur = map.get(key) ?? {
      customerId: row.customerId,
      customerName: name,
      invoiceCount: 0,
      total: 0,
    };
    cur.invoiceCount += 1;
    cur.total = roundMoney(cur.total + (Number(row.total) || 0));
    map.set(key, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.total - a.total || a.customerName.localeCompare(b.customerName),
  );
}

/** Roll catalog/service line amounts by product or service id. */
export function aggregateNamedIncome(
  rows: {
    id: string;
    name: string;
    code?: string | null;
    qty: number;
    unitPrice: number;
    discountPct: number;
  }[],
): IncomeNameRow[] {
  const map = new Map<string, IncomeNameRow>();
  for (const row of rows) {
    const amount = lineAmount(row);
    const cur = map.get(row.id) ?? {
      id: row.id,
      name: row.name,
      code: row.code ?? null,
      lineCount: 0,
      total: 0,
    };
    cur.lineCount += 1;
    cur.total = roundMoney(cur.total + amount);
    map.set(row.id, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
}

export function normalizeTextKind(
  raw: string | null | undefined,
): TextItemKind {
  if (raw === "sale") return "sale";
  if (raw === "rental") return "rental";
  return "untagged";
}

export function buildTextItemRows(
  rows: {
    lineId: string;
    opportunityId: string;
    opportunityReference: string;
    description: string;
    qty: number;
    unitPrice: number;
    discountPct: number;
    textKind?: string | null;
  }[],
): TextItemRow[] {
  return rows
    .map((row) => ({
      lineId: row.lineId,
      opportunityId: row.opportunityId,
      opportunityReference: row.opportunityReference,
      description: row.description.trim() || "(no description)",
      qty: Number(row.qty) || 0,
      unitPrice: Number(row.unitPrice) || 0,
      total: lineAmount(row),
      textKind: normalizeTextKind(row.textKind),
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.opportunityReference.localeCompare(b.opportunityReference),
    );
}

/** KM textRentals: rental + untagged free-text lines. */
export function filterTextRentals(rows: TextItemRow[]): TextItemRow[] {
  return rows.filter((r) => r.textKind === "rental" || r.textKind === "untagged");
}

/** KM textSales: sale-tagged free-text lines only. */
export function filterTextSales(rows: TextItemRow[]): TextItemRow[] {
  return rows.filter((r) => r.textKind === "sale");
}

export function buildContactRows(
  customers: {
    id: string;
    name: string;
    contact_name: string;
    email: string;
    phone: string;
  }[],
  venues: {
    id: string;
    name: string;
    contact_name: string;
    email: string;
    phone: string;
  }[],
): ContactReportRow[] {
  const out: ContactReportRow[] = [];
  for (const c of customers) {
    const contactName = (c.contact_name ?? "").trim();
    const email = (c.email ?? "").trim();
    const phone = (c.phone ?? "").trim();
    if (!contactName && !email && !phone) continue;
    out.push({
      id: `customer:${c.id}`,
      kind: "customer",
      organizationName: c.name,
      contactName: contactName || "—",
      email,
      phone,
    });
  }
  for (const v of venues) {
    const contactName = (v.contact_name ?? "").trim();
    const email = (v.email ?? "").trim();
    const phone = (v.phone ?? "").trim();
    if (!contactName && !email && !phone) continue;
    out.push({
      id: `venue:${v.id}`,
      kind: "venue",
      organizationName: v.name,
      contactName: contactName || "—",
      email,
      phone,
    });
  }
  return out.sort((a, b) => {
    const byOrg = a.organizationName.localeCompare(b.organizationName);
    if (byOrg !== 0) return byOrg;
    return a.contactName.localeCompare(b.contactName);
  });
}
