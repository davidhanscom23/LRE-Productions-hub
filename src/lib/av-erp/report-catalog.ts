/**
 * Hub Vident AV Reports catalog + full KM AV CRM 19-report registry
 * (from km-av-crm.vercel.app/reports bundle). Map KM keys onto existing Hub
 * sections; do not invent empty Hub pages for unmapped KM reports.
 */

export type AvReportSectionDef = {
  id: string;
  /** Short jump-nav label */
  jumpLabel: string;
  title: string;
  blurb: string;
  /** Hub search / filter tokens */
  keywords: string[];
  /** Known KM report keys (and labels via KM_REPORT_CATALOG) */
  kmAliases: string[];
};

/** One row from KM’s Reports menu (exactly 19). */
export type KmReportDef = {
  key: string;
  label: string;
  column: string;
  /** Closest Hub Reports section id, or null if Hub has no equivalent. */
  hubSectionId: string | null;
  note?: string;
};

/**
 * Exact KM Reports menu (key / label / column) from the live KM AV CRM app.
 * Terminal Mode is a settings/API surface, not a report — omitted on purpose.
 */
export const KM_REPORT_CATALOG: KmReportDef[] = [
  {
    key: "customer",
    label: "Customer income",
    column: "Customer",
    hubSectionId: "customer-income",
  },
  {
    key: "rental",
    label: "Product rental income",
    column: "Product",
    hubSectionId: "rental-income",
  },
  {
    key: "sale",
    label: "Product sale income",
    column: "Product",
    hubSectionId: "sale-income",
  },
  {
    key: "service",
    label: "Service income",
    column: "Service",
    hubSectionId: "service-income",
  },
  {
    key: "subRent",
    label: "Product sub rents",
    column: "Supplier",
    hubSectionId: "sub-rent",
  },
  {
    key: "subContract",
    label: "Service sub contracts",
    column: "Supplier",
    hubSectionId: "sub-contract",
  },
  {
    key: "neverBooked",
    label: "Never rented or sold",
    column: "Product",
    hubSectionId: "never-booked",
  },
  {
    key: "whatsOut",
    label: "What's out where",
    column: "Product",
    hubSectionId: "gear",
  },
  {
    key: "whosOut",
    label: "Who's out where",
    column: "Crew",
    hubSectionId: "crew",
  },
  {
    key: "profit",
    label: "Profit",
    column: "Job",
    hubSectionId: "profit",
  },
  {
    key: "payments",
    label: "Payment transactions",
    column: "Invoice",
    hubSectionId: "payments",
  },
  {
    key: "stock",
    label: "Stock transactions",
    column: "Product",
    hubSectionId: "stock-txns",
  },
  {
    key: "oppSubRents",
    label: "Opportunity sub rents",
    column: "Job",
    hubSectionId: "opp-sub-rents",
  },
  {
    key: "partiallyInvoiced",
    label: "Partially invoiced opportunities",
    column: "Job",
    hubSectionId: "partially-invoiced",
  },
  {
    key: "oppCosts",
    label: "Opportunity costs",
    column: "Job",
    hubSectionId: "opp-costs",
  },
  {
    key: "salesStock",
    label: "Sales stock list",
    column: "Product",
    hubSectionId: "sales-stock",
  },
  {
    key: "textRentals",
    label: "Text item rentals",
    column: "Item",
    hubSectionId: "text-rentals",
  },
  {
    key: "textSales",
    label: "Text item sales",
    column: "Item",
    hubSectionId: "text-sales",
  },
  {
    key: "contacts",
    label: "Contacts with linked organizations",
    column: "Contact",
    hubSectionId: "contacts",
  },
];

function kmKeysForHubSection(hubSectionId: string): string[] {
  return KM_REPORT_CATALOG.filter((r) => r.hubSectionId === hubSectionId).map(
    (r) => r.key,
  );
}

function kmLabelsForHubSection(hubSectionId: string): string[] {
  return KM_REPORT_CATALOG.filter((r) => r.hubSectionId === hubSectionId).map(
    (r) => r.label,
  );
}

export const AV_REPORT_CATALOG: AvReportSectionDef[] = [
  {
    id: "customer-income",
    jumpLabel: "Customer income",
    title: "Customer income",
    blurb: "Non-void invoice totals rolled up by customer.",
    keywords: [
      "customer income",
      "income by customer",
      ...kmLabelsForHubSection("customer-income"),
    ],
    kmAliases: kmKeysForHubSection("customer-income"),
  },
  {
    id: "rental-income",
    jumpLabel: "Rental income",
    title: "Product rental income",
    blurb:
      "Quote/order/closed lines linked to rental catalog products (staff unit prices).",
    keywords: [
      "rental income",
      "product rental",
      ...kmLabelsForHubSection("rental-income"),
    ],
    kmAliases: kmKeysForHubSection("rental-income"),
  },
  {
    id: "sale-income",
    jumpLabel: "Sale income",
    title: "Product sale income",
    blurb:
      "Quote/order/closed lines linked to sale or consumable products (staff unit prices).",
    keywords: [
      "sale income",
      "product sale",
      ...kmLabelsForHubSection("sale-income"),
    ],
    kmAliases: kmKeysForHubSection("sale-income"),
  },
  {
    id: "service-income",
    jumpLabel: "Service income",
    title: "Service income",
    blurb:
      "Quote/order/closed lines linked to catalog services (staff unit prices).",
    keywords: [
      "service income",
      ...kmLabelsForHubSection("service-income"),
    ],
    kmAliases: kmKeysForHubSection("service-income"),
  },
  {
    id: "text-rentals",
    jumpLabel: "Text rentals",
    title: "Text item rentals",
    blurb:
      "Free-text estimate lines tagged rental (plus untagged text lines). Set the tag on the estimate line.",
    keywords: [
      "text items",
      "text rentals",
      "free text",
      ...kmLabelsForHubSection("text-rentals"),
    ],
    kmAliases: kmKeysForHubSection("text-rentals"),
  },
  {
    id: "text-sales",
    jumpLabel: "Text sales",
    title: "Text item sales",
    blurb:
      "Free-text estimate lines tagged sale. Set the tag on the estimate line when adding or editing.",
    keywords: [
      "text sales",
      "free text sale",
      ...kmLabelsForHubSection("text-sales"),
    ],
    kmAliases: kmKeysForHubSection("text-sales"),
  },
  {
    id: "contacts",
    jumpLabel: "Contacts",
    title: "Contacts with organizations",
    blurb:
      "Customer and venue contact names with email/phone, linked to the organization or venue.",
    keywords: [
      "contacts",
      "organizations",
      ...kmLabelsForHubSection("contacts"),
    ],
    kmAliases: kmKeysForHubSection("contacts"),
  },
  {
    id: "profit",
    jumpLabel: "Profit",
    title: "Job profit",
    blurb:
      "Revenue (invoices else estimate customer total) minus booked costs — Hub profit view.",
    keywords: [
      "profit",
      "margin",
      "revenue",
      "job profit",
      ...kmLabelsForHubSection("profit"),
    ],
    kmAliases: kmKeysForHubSection("profit"),
  },
  {
    id: "opp-costs",
    jumpLabel: "Costs by category",
    title: "Costs by category",
    blurb:
      "Booked job costs rolled up by category across open and closed jobs.",
    keywords: [
      "costs",
      "category",
      "opp costs",
      "labor",
      "sub hire",
      ...kmLabelsForHubSection("opp-costs"),
    ],
    kmAliases: kmKeysForHubSection("opp-costs"),
  },
  {
    id: "sub-rent",
    jumpLabel: "Sub rents",
    title: "Product sub rents",
    blurb: "Sub-hire job costs rolled up by supplier.",
    keywords: [
      "sub rent",
      "sub-hire",
      "supplier",
      ...kmLabelsForHubSection("sub-rent"),
    ],
    kmAliases: kmKeysForHubSection("sub-rent"),
  },
  {
    id: "opp-sub-rents",
    jumpLabel: "Job sub rents",
    title: "Opportunity sub rents",
    blurb: "Sub-hire costs listed by job.",
    keywords: [
      "opportunity sub rents",
      "sub-hire by job",
      ...kmLabelsForHubSection("opp-sub-rents"),
    ],
    kmAliases: kmKeysForHubSection("opp-sub-rents"),
  },
  {
    id: "sub-contract",
    jumpLabel: "Sub contracts",
    title: "Service sub contracts",
    blurb: "Labor costs with a supplier (subcontracted crew/services).",
    keywords: [
      "sub contract",
      "subcontract",
      "labor supplier",
      ...kmLabelsForHubSection("sub-contract"),
    ],
    kmAliases: kmKeysForHubSection("sub-contract"),
  },
  {
    id: "ar",
    jumpLabel: "Open AR",
    title: "Open AR",
    blurb: "Non-void invoices with an unpaid balance.",
    keywords: [
      "ar",
      "accounts receivable",
      "unpaid",
      "invoices",
      ...kmLabelsForHubSection("ar"),
    ],
    kmAliases: kmKeysForHubSection("ar"),
  },
  {
    id: "payments",
    jumpLabel: "Payments",
    title: "Payment transactions",
    blurb: "Every payment recorded against a Hub invoice.",
    keywords: [
      "payments",
      "payment ledger",
      "transactions",
      ...kmLabelsForHubSection("payments"),
    ],
    kmAliases: kmKeysForHubSection("payments"),
  },
  {
    id: "partially-invoiced",
    jumpLabel: "Partial invoices",
    title: "Partially invoiced opportunities",
    blurb:
      "Jobs where invoice total is under the estimate customer total, or any invoice is marked partial.",
    keywords: [
      "partially invoiced",
      "partial invoice",
      ...kmLabelsForHubSection("partially-invoiced"),
    ],
    kmAliases: kmKeysForHubSection("partially-invoiced"),
  },
  {
    id: "aging",
    jumpLabel: "AR aging",
    title: "Invoice aging",
    blurb: "Open AR totals by days past due date.",
    keywords: ["aging", "past due", "ar aging"],
    kmAliases: [],
  },
  {
    id: "pipeline",
    jumpLabel: "Pipeline",
    title: "Open pipeline",
    blurb: "Open jobs by Draft / Quotation / Order.",
    keywords: ["pipeline", "quotes", "estimates", "orders", "draft"],
    kmAliases: [],
  },
  {
    id: "gear",
    jumpLabel: "Gear out",
    title: "Gear still out",
    blurb: "Hub check-outs not yet checked back. Overdue = past gear-back.",
    keywords: [
      "gear out",
      "still out",
      "warehouse",
      "checkout",
      "whats out",
      ...kmLabelsForHubSection("gear"),
    ],
    kmAliases: kmKeysForHubSection("gear"),
  },
  {
    id: "overdue-gear",
    jumpLabel: "Overdue gear",
    title: "Overdue gear",
    blurb: "Still-out lines past the job’s gear-back time.",
    keywords: ["overdue", "late gear", "gear back"],
    kmAliases: [],
  },
  {
    id: "checkout",
    jumpLabel: "Checkout ready",
    title: "Checkout ready",
    blurb: "Reserved qty still waiting to leave the warehouse.",
    keywords: ["checkout ready", "reserved", "warehouse"],
    kmAliases: [],
  },
  {
    id: "stock",
    jumpLabel: "Low stock",
    title: "Low stock",
    blurb:
      "Active catalog items with owned qty and zero free (all out on jobs).",
    keywords: ["stock", "inventory", "low stock", "free qty"],
    kmAliases: [],
  },
  {
    id: "sales-stock",
    jumpLabel: "Sales stock",
    title: "Sales stock list",
    blurb: "Active sale and consumable products with owned / out / free qty.",
    keywords: [
      "sales stock",
      "sale inventory",
      "consumable",
      ...kmLabelsForHubSection("sales-stock"),
    ],
    kmAliases: kmKeysForHubSection("sales-stock"),
  },
  {
    id: "never-booked",
    jumpLabel: "Never booked",
    title: "Never rented or sold",
    blurb:
      "Active catalog products that have never appeared on a quotation, order, or closed job.",
    keywords: [
      "never booked",
      "never rented",
      "unused catalog",
      ...kmLabelsForHubSection("never-booked"),
    ],
    kmAliases: kmKeysForHubSection("never-booked"),
  },
  {
    id: "stock-txns",
    jumpLabel: "Stock txns",
    title: "Stock transactions",
    blurb: "Warehouse check-out and check-back movements.",
    keywords: [
      "stock transactions",
      "movements",
      "check out",
      "check back",
      ...kmLabelsForHubSection("stock-txns"),
    ],
    kmAliases: kmKeysForHubSection("stock-txns"),
  },
  {
    id: "crew",
    jumpLabel: "Crew",
    title: "Crew upcoming",
    blurb:
      "Bookings starting today or later (Eastern), excluding cancelled.",
    keywords: [
      "crew",
      "bookings",
      "day rate",
      "labor",
      "whos out",
      ...kmLabelsForHubSection("crew"),
    ],
    kmAliases: kmKeysForHubSection("crew"),
  },
  {
    id: "activities",
    jumpLabel: "Activities",
    title: "Open activities",
    blurb: "Unsettled pre-job tasks, overdue first.",
    keywords: ["activities", "tasks", "pre-job"],
    kmAliases: [],
  },
  {
    id: "travel",
    jumpLabel: "Travel windows",
    title: "Gear windows (next 14 days)",
    blurb:
      "Jobs whose gear out→back overlaps the next two weeks (Eastern).",
    keywords: ["travel", "windows", "gear dates", "leave"],
    kmAliases: [],
  },
];

export function reportSectionBlurb(section: AvReportSectionDef): string {
  if (section.kmAliases.length === 0) return section.blurb;
  const alias = section.kmAliases.join(", ");
  return `${section.blurb} KM: ${alias}.`;
}

export function unmappedKmReports(): KmReportDef[] {
  return KM_REPORT_CATALOG.filter((r) => r.hubSectionId == null);
}

export function filterKmReports(query: string): KmReportDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return KM_REPORT_CATALOG;
  return KM_REPORT_CATALOG.filter((r) => {
    const hay = [r.key, r.label, r.column, r.note ?? "", r.hubSectionId ?? ""]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Case-insensitive match on title, jump label, keywords, or KM aliases. */
export function filterReportCatalog(
  query: string,
  catalog: AvReportSectionDef[] = AV_REPORT_CATALOG,
): AvReportSectionDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;

  const kmHits = new Set(
    filterKmReports(q)
      .map((r) => r.hubSectionId)
      .filter((id): id is string => Boolean(id)),
  );

  return catalog.filter((s) => {
    if (kmHits.has(s.id)) return true;
    const hay = [
      s.id,
      s.jumpLabel,
      s.title,
      s.blurb,
      ...s.keywords,
      ...s.kmAliases,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Flatten keywords + kmAliases for Hub search nav-targets. */
export function reportCatalogSearchKeywords(): string[] {
  const set = new Set<string>(["reports", "av", "km"]);
  for (const s of AV_REPORT_CATALOG) {
    for (const k of s.keywords) set.add(k);
    for (const a of s.kmAliases) set.add(a);
  }
  for (const r of KM_REPORT_CATALOG) {
    set.add(r.key);
    set.add(r.label);
  }
  return [...set];
}
