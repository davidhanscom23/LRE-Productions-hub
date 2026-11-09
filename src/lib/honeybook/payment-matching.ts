/**
 * Suggest which HoneyBook project an unlinked payment belongs to.
 *
 * Pure functions: the Payments "Needs review" queue and its tests share them. A payment scores
 * points for a similar project name (read from the payment's saved HoneyBook payload), the same
 * client, a project date near the payment date, and other payments already on that project from
 * the same client. Staff always approve; nothing is linked automatically.
 */

import { normalizeProjectName } from "./duplicates";

export type MatchPayment = {
  id: string;
  client_id?: string | null;
  client_email?: string | null;
  paid_at?: string | null;
  note?: string | null;
  raw?: Record<string, unknown> | null;
};

export type MatchProject = {
  id: string;
  name: string;
  client_id?: string | null;
  client_email?: string | null;
  project_date?: string | null;
  merged_into?: string | null;
  record_type?: string | null;
};

export type PaymentSuggestion = {
  projectId: string;
  score: number;
  reasons: string[];
};

/** Score needed before a project is offered as a suggestion. */
export const PAYMENT_MATCH_THRESHOLD = 3;
export const MAX_SUGGESTIONS = 3;

const FILLER = new Set([
  "the", "a", "an", "and", "of", "for", "at", "in", "event", "events", "party",
  "project", "new", "payment",
]);

function tokens(raw: string): Set<string> {
  const out = new Set<string>();
  for (const t of normalizeProjectName(raw).split(" ")) {
    if (t && !FILLER.has(t)) out.add(t);
  }
  return out;
}

/** Share of the smaller name's words found in the other (0..1). */
export function nameOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

/** The HoneyBook project name saved in the payment's payload, when there is one. */
export function paymentProjectName(raw: Record<string, unknown> | null | undefined): string {
  if (!raw || typeof raw !== "object") return "";
  const direct = raw["project_name"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = raw["project"];
  if (nested && typeof nested === "object") {
    const n = (nested as Record<string, unknown>)["name"];
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return "";
}

function dayNumber(raw: string | null | undefined): number | null {
  const m = (raw ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000);
}

export function suggestProjectsForPayment(
  payment: MatchPayment,
  projects: MatchProject[],
  opts: { rejectedProjectIds?: string[]; clientProjectIds?: Set<string> } = {},
): PaymentSuggestion[] {
  const rejected = new Set(opts.rejectedProjectIds ?? []);
  const wantName = paymentProjectName(payment.raw);
  const payEmail = (payment.client_email ?? "").trim().toLowerCase();
  const payDay = dayNumber(payment.paid_at);
  const out: PaymentSuggestion[] = [];

  for (const p of projects) {
    if (p.merged_into || p.record_type === "partnership") continue;
    if (rejected.has(p.id)) continue;
    let score = 0;
    const reasons: string[] = [];

    if (wantName) {
      const a = normalizeProjectName(wantName);
      const b = normalizeProjectName(p.name);
      if (a && a === b) {
        score += 5;
        reasons.push("same name");
      } else {
        const o = nameOverlap(wantName, p.name);
        if (o >= 0.99) {
          score += 4;
          reasons.push("name contained in the project name");
        } else if (o >= 0.6) {
          score += 3;
          reasons.push("similar name");
        } else if (o >= 0.34) {
          score += 1;
          reasons.push("some words match");
        }
      }
    }

    const sameClient =
      (payment.client_id && p.client_id && payment.client_id === p.client_id) ||
      (payEmail && (p.client_email ?? "").trim().toLowerCase() === payEmail);
    if (sameClient) {
      score += 3;
      reasons.push("same client");
    }

    if (opts.clientProjectIds?.has(p.id)) {
      score += 1;
      reasons.push("client already paid on it");
    }

    const projDay = dayNumber(p.project_date);
    if (payDay != null && projDay != null) {
      const gap = projDay - payDay;
      if (gap >= -3 && gap <= 120) {
        score += 1;
        reasons.push("event date near this payment");
      }
    }

    if (score >= PAYMENT_MATCH_THRESHOLD) {
      out.push({ projectId: p.id, score, reasons });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, MAX_SUGGESTIONS);
}

/** A payment needs review while it has no project and nobody marked it "no project". */
export function needsMatchReview(p: {
  project_id?: string | null;
  raw?: Record<string, unknown> | null;
}): boolean {
  if (p.project_id) return false;
  return !(p.raw && (p.raw as Record<string, unknown>)["match_no_project"] === true);
}

export function rejectedProjectIds(raw: Record<string, unknown> | null | undefined): string[] {
  const v = raw?.["match_rejected_project_ids"];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
