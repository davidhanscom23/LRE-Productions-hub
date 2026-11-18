/**
 * Partner expenses: the David & Luke startup expense ledger.
 * Pure helpers shared by the page, the server actions and the tests.
 */

export type Partner = "david" | "luke";
export const PARTNERS: Partner[] = ["david", "luke"];
export const PARTNER_NAMES: Record<Partner, string> = {
  david: "David",
  luke: "Luke",
};

export const PARTNER_CATEGORIES = [
  { value: "equipment", label: "Equipment" },
  { value: "software", label: "Software & subscriptions" },
  { value: "legal", label: "Legal & filing" },
  { value: "insurance", label: "Insurance" },
  { value: "marketing", label: "Marketing & website" },
  { value: "travel", label: "Travel & mileage" },
  { value: "supplies", label: "Supplies" },
  { value: "meals", label: "Meals" },
  { value: "other", label: "Other" },
] as const;

export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number]["value"];

const CATEGORY_VALUES = new Set<string>(PARTNER_CATEGORIES.map((c) => c.value));

export function cleanCategory(value: string): PartnerCategory {
  return (CATEGORY_VALUES.has(value) ? value : "other") as PartnerCategory;
}

export function categoryLabel(value: string): string {
  return PARTNER_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export type PartnerExpense = {
  id: string;
  paid_by: Partner;
  amount_cents: number;
  description: string;
  category: string;
  expense_date: string;
  note: string;
  receipt_path: string;
  receipt_name: string;
  /** Short-lived signed link, filled in by the page. */
  receipt_url: string | null;
  reimbursed_at: string | null;
  flagged_at: string | null;
  flag_note: string;
  voided_at: string | null;
  void_reason: string;
  created_by: string;
  created_at: string;
};

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** "1,250.50" or "$49.99" to cents. Null when it is not a positive amount with at most 2 decimals. */
export function parseAmountToCents(input: string): number | null {
  const t = String(input ?? "").replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(t) || t === "" || t === ".") return null;
  const cents = Math.round(Number.parseFloat(t) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents >= 100_000_000) return null;
  return cents;
}

export type PersonTotals = {
  total: number;
  count: number;
  /** Paid out of pocket and not yet reimbursed. */
  outstanding: number;
  reimbursed: number;
};

export type Summary = {
  total: number;
  count: number;
  david: PersonTotals;
  luke: PersonTotals;
  /** david minus luke, in cents. Positive means David has paid more. */
  gap: number;
  outstanding: number;
  flagged: number;
  byCategory: { category: string; david: number; luke: number }[];
  byMonth: { month: string; david: number; luke: number }[];
};

const emptyPerson = (): PersonTotals => ({
  total: 0,
  count: 0,
  outstanding: 0,
  reimbursed: 0,
});

/** Voided expenses never count toward any total. */
export function summarize(rows: PartnerExpense[]): Summary {
  const live = rows.filter((r) => !r.voided_at);
  const s: Summary = {
    total: 0,
    count: live.length,
    david: emptyPerson(),
    luke: emptyPerson(),
    gap: 0,
    outstanding: 0,
    flagged: 0,
    byCategory: [],
    byMonth: [],
  };
  const cats = new Map<string, { david: number; luke: number }>();
  const months = new Map<string, { david: number; luke: number }>();

  for (const r of live) {
    const p = s[r.paid_by];
    p.total += r.amount_cents;
    p.count += 1;
    if (r.reimbursed_at) p.reimbursed += r.amount_cents;
    else p.outstanding += r.amount_cents;
    s.total += r.amount_cents;
    if (r.flagged_at) s.flagged += 1;

    const c = cats.get(r.category) ?? { david: 0, luke: 0 };
    c[r.paid_by] += r.amount_cents;
    cats.set(r.category, c);

    const m = (r.expense_date || "").slice(0, 7);
    if (m) {
      const mm = months.get(m) ?? { david: 0, luke: 0 };
      mm[r.paid_by] += r.amount_cents;
      months.set(m, mm);
    }
  }

  s.gap = s.david.total - s.luke.total;
  s.outstanding = s.david.outstanding + s.luke.outstanding;
  s.byCategory = [...cats.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.david + b.luke - (a.david + a.luke));
  s.byMonth = [...months.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return s;
}

/** Plain-English label for an audit action. */
export function auditActionLabel(action: string): string {
  switch (action) {
    case "created":
      return "Added an expense";
    case "edited":
      return "Edited an expense";
    case "voided":
      return "Voided an expense";
    case "reimbursed":
      return "Marked reimbursed";
    case "reimbursement_undone":
      return "Undid a reimbursement";
    case "flagged":
      return "Flagged an expense";
    case "flag_cleared":
      return "Cleared a flag";
    case "receipt_changed":
      return "Changed the receipt";
    case "roster_insert":
      return "Added a partner to the ledger";
    case "roster_update":
      return "Changed a partner on the ledger";
    case "roster_delete":
      return "Removed a partner from the ledger";
    default:
      return action;
  }
}
