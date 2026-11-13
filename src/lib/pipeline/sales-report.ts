import { pipelineStageMatchKey } from "@/lib/pipeline/pipeline-board";

export type ReportProject = {
  stage: string | null;
  source_event: string | null;
  raw: Record<string, unknown> | null;
  budget: number | string | null;
  created_at: string;
  booked_at: string | null;
  project_type: string | null;
  record_type?: string | null;
  merged_into?: string | null;
};

export type Outcome = "booked" | "lost" | "open";

const BOOKED_KEYS = new Set(["retainer paid", "paid in full", "completed", "booked"]);

export function outcomeOf(p: Pick<ReportProject, "stage" | "booked_at">): Outcome {
  const key = pipelineStageMatchKey(p.stage);
  if (key === "lost" || key === "not booked") return "lost";
  if (BOOKED_KEYS.has(key) || p.booked_at) return "booked";
  return "open";
}

const RAW_SOURCE_KEYS = ["lead_source", "Lead Source", "leadSource", "source", "Source", "referral", "Referral"];

/** Where the lead came from: an explicit value if present, otherwise how the card was created. */
export function leadSourceOf(p: Pick<ReportProject, "source_event" | "raw">): string {
  const raw = p.raw ?? {};
  for (const k of RAW_SOURCE_KEYS) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 60);
  }
  const ev = (p.source_event ?? "").toLowerCase();
  if (ev === "web_form") return "Website form";
  if (ev === "hub") return "Added in the Hub";
  return "Other";
}

const num = (v: number | string | null) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

export type SourceRow = {
  source: string;
  total: number;
  booked: number;
  lost: number;
  open: number;
  /** booked / (booked + lost), or null when nothing is decided yet. */
  rate: number | null;
  bookedValue: number;
};

export type MonthRow = { month: string; inquiries: number; booked: number; lost: number; bookedValue: number };

export type SalesReport = {
  total: number;
  booked: number;
  lost: number;
  open: number;
  bookingRate: number | null;
  bookedValue: number;
  avgBookedValue: number | null;
  avgDaysToBook: number | null;
  bySource: SourceRow[];
  byMonth: MonthRow[];
  byType: SourceRow[];
};

function groupRows(items: { key: string; o: Outcome; value: number }[]): SourceRow[] {
  const map = new Map<string, SourceRow>();
  for (const { key, o, value } of items) {
    const r = map.get(key) ?? { source: key, total: 0, booked: 0, lost: 0, open: 0, rate: null, bookedValue: 0 };
    r.total++;
    r[o]++;
    if (o === "booked") r.bookedValue += value;
    map.set(key, r);
  }
  return [...map.values()]
    .map((r) => ({ ...r, rate: r.booked + r.lost > 0 ? r.booked / (r.booked + r.lost) : null }))
    .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));
}

/**
 * Compute booking stats. Partnerships and merged-away cards are skipped.
 * `from` (YYYY-MM-DD, inclusive) limits to projects created on or after that day.
 */
export function buildSalesReport(projects: ReportProject[], opts: { from?: string | null } = {}): SalesReport {
  const rows = projects.filter(
    (p) => p.record_type !== "partnership" && !p.merged_into && (!opts.from || p.created_at.slice(0, 10) >= opts.from),
  );
  const tagged = rows.map((p) => ({ p, o: outcomeOf(p), value: num(p.budget) }));
  const booked = tagged.filter((t) => t.o === "booked");
  const lost = tagged.filter((t) => t.o === "lost").length;
  const bookedValue = booked.reduce((s, t) => s + t.value, 0);
  const valued = booked.filter((t) => t.value > 0);

  const days: number[] = [];
  for (const t of booked) {
    if (!t.p.booked_at) continue;
    const d = (Date.parse(t.p.booked_at) - Date.parse(t.p.created_at)) / 86_400_000;
    if (Number.isFinite(d) && d >= 0 && d < 1500) days.push(d);
  }

  const months = new Map<string, MonthRow>();
  for (const t of tagged) {
    const m = t.p.created_at.slice(0, 7);
    const r = months.get(m) ?? { month: m, inquiries: 0, booked: 0, lost: 0, bookedValue: 0 };
    r.inquiries++;
    if (t.o === "booked") {
      r.booked++;
      r.bookedValue += t.value;
    } else if (t.o === "lost") r.lost++;
    months.set(m, r);
  }

  return {
    total: rows.length,
    booked: booked.length,
    lost,
    open: rows.length - booked.length - lost,
    bookingRate: booked.length + lost > 0 ? booked.length / (booked.length + lost) : null,
    bookedValue,
    avgBookedValue: valued.length ? valued.reduce((s, t) => s + t.value, 0) / valued.length : null,
    avgDaysToBook: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
    bySource: groupRows(tagged.map((t) => ({ key: leadSourceOf(t.p), o: t.o, value: t.value }))),
    byType: groupRows(tagged.map((t) => ({ key: (t.p.project_type ?? "").trim() || "(no type)", o: t.o, value: t.value }))),
    byMonth: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
  };
}
