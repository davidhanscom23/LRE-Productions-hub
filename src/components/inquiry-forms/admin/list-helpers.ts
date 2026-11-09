/**
 * Inquiry Forms admin: pure helpers for the forms list and the server actions.
 * No server-only or browser-only imports (vitest covers this file).
 */
import type { FormStats, FormStatus } from "./list-types";

export const FORM_STATUS_LABEL: Record<FormStatus, string> = {
  draft: "Draft",
  live: "Live",
  paused: "Paused",
  archived: "Archived",
};

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";

export const FORM_STATUS_TONE: Record<FormStatus, Tone> = {
  draft: "neutral",
  live: "good",
  paused: "warn",
  archived: "neutral",
};

/** numerator / denominator as a percentage with one decimal, null when the denominator is 0. */
export function percentOf(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  const pct = (Math.max(0, numerator) / denominator) * 100;
  return Math.round(pct * 10) / 10;
}

/** "12.5%" (whole numbers lose the ".0"), or "-" when there is nothing to divide by. */
export function formatPercent(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "-";
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function formatCount(n: number): string {
  return Number.isFinite(n) ? Math.max(0, Math.round(n)).toLocaleString("en-US") : "0";
}

export function emptyStats(): FormStats {
  return { views: 0, starts: 0, completes: 0 };
}

/** Adds one inquiry_form_stats row into a running total (null and non-numeric counts read as 0). */
export function addStats(total: FormStats, row: { views?: unknown; starts?: unknown; completes?: unknown }): FormStats {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  return {
    views: total.views + n(row.views),
    starts: total.starts + n(row.starts),
    completes: total.completes + n(row.completes),
  };
}

/**
 * True when a PostgREST / Postgres error means the inquiry tables are not there yet
 * (the Inquiry Forms migration not run): Postgres 42P01 "relation does not exist", PostgREST PGRST205
 * "Could not find the table ... in the schema cache", PGRST202 for a missing function.
 */
export function isMissingTableError(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code ?? "");
  if (code === "42P01" || code === "PGRST205" || code === "PGRST202") return true;
  const msg = String(err.message ?? "");
  return /relation "[^"]+" does not exist/i.test(msg) || /could not find the (table|function)/i.test(msg);
}

/** Postgres unique violation (e.g. a slug taken between the check and the insert). */
export function isUniqueViolation(err: { code?: string | null } | null | undefined): boolean {
  return String(err?.code ?? "") === "23505";
}

const SLUG_MAX = 60;

/**
 * First free slug: base, base-2, base-3 ... (kept within 60 characters).
 * `base` must already be a valid slug.
 */
export function nextAvailableSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; i < 10_000; i += 1) {
    const suffix = `-${i}`;
    const head = base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "");
    const candidate = `${head}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  // Practically unreachable; a timestamp suffix still yields a valid slug.
  const stamp = `-${Date.now().toString(36)}`;
  return `${base.slice(0, SLUG_MAX - stamp.length).replace(/-+$/, "")}${stamp}`;
}

const NAME_MAX = 120;

/** "Check Your Date (copy)", then "(copy 2)", "(copy 3)" ... never longer than 120 characters. */
export function copyName(name: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, (n) => n.trim().toLowerCase()));
  const root = name.trim().replace(/\s*\(copy(?: \d+)?\)$/i, "") || "Form";
  for (let i = 1; i < 10_000; i += 1) {
    const suffix = i === 1 ? " (copy)" : ` (copy ${i})`;
    const candidate = `${root.slice(0, NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${root.slice(0, NAME_MAX - 7).trimEnd()} (copy)`;
}

/** Same instant? Tolerates "2026-11-04 13:12:45.123456+00" vs ISO "2026-11-04T13:12:45.123Z" (ms precision). */
export function sameInstant(a: unknown, b: unknown): boolean {
  const ms = (v: unknown): number => {
    if (typeof v !== "string" || !v.trim()) return Number.NaN;
    let t = v.trim();
    if (/^\d{4}-\d{2}-\d{2} \d/.test(t)) t = t.replace(" ", "T");
    if (/[+-]\d{2}$/.test(t)) t = `${t}:00`;
    return Date.parse(t);
  };
  const x = ms(a);
  const y = ms(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1;
}

const NY_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * The instant (ISO, UTC) of 00:00 America/New_York on wall date `ymd` ("YYYY-MM-DD"), so a
 * "last 30 days" filter on timestamps lines up with the Eastern-day stats rows. Midnight is never
 * inside a DST jump (they happen at 2 AM), so one of the two offsets always matches.
 */
export function easternMidnightIso(ymd: string): string {
  for (const offset of ["-05:00", "-04:00"]) {
    const t = Date.parse(`${ymd}T00:00:00${offset}`);
    if (!Number.isFinite(t)) continue;
    const parts: Record<string, string> = {};
    for (const p of NY_PARTS.formatToParts(new Date(t))) parts[p.type] = p.value;
    if (`${parts.year}-${parts.month}-${parts.day}` === ymd && parts.hour === "00" && parts.minute === "00") {
      return new Date(t).toISOString();
    }
  }
  return new Date(Date.parse(`${ymd}T05:00:00Z`)).toISOString();
}

/** Trimmed form name, or an error message in plain language. */
export function checkFormName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) return { ok: false, error: "Give the form a name." };
  if (name.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` };
  return { ok: true, name };
}
