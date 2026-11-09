/**
 * Inquiry Forms - lead score and the celebration verdict.
 *
 * PURE module. The score is computed ONCE from the server-decided Qualification (never
 * accumulated per save, which double counted budget in LeadGate), always an integer 0..100 so the
 * DB CHECK (score between 0 and 100) and label CHECK (high | medium | low) accept every value.
 */

import type { CheckKind, DateResult, LocationResult, Qualification, ScoreLabel } from "./types";

export const SCORE_BASE = 50;
export const SCORE_HIGH_AT = 70;
export const SCORE_MEDIUM_AT = 40;

/** Points per date verdict; an absent date verdict scores like "unknown". */
export const DATE_POINTS: Record<DateResult, number> = {
  available: 30,
  open: 20,
  limited: 10,
  unknown: 5,
  skipped: 5,
  unavailable: -20,
  blackout: -20,
  too_soon: -20,
};

/** Points per location verdict; an absent location verdict scores like "unverified". */
export const LOCATION_POINTS: Record<LocationResult, number> = {
  pass: 20,
  risky: 10,
  talk: 5,
  unverified: 5,
  skipped: 5,
  fail: -20,
};

export const BUDGET_PASSED_POINTS = 10;
export const BUDGET_FAILED_POINTS = -15;
export const ALT_DATE_POINTS = 15;

const ABSENT_POINTS = 5;

function datePoints(q: Qualification): number {
  const r = q?.date?.result;
  return typeof r === "string" && Object.prototype.hasOwnProperty.call(DATE_POINTS, r)
    ? DATE_POINTS[r as DateResult]
    : ABSENT_POINTS;
}

function locationPoints(q: Qualification): number {
  const r = q?.location?.result;
  return typeof r === "string" && Object.prototype.hasOwnProperty.call(LOCATION_POINTS, r)
    ? LOCATION_POINTS[r as LocationResult]
    : ABSENT_POINTS;
}

/** "high" at 70 or more, "medium" at 40 or more, else "low". */
export function scoreLabelFor(score: number): ScoreLabel {
  if (score >= SCORE_HIGH_AT) return "high";
  if (score >= SCORE_MEDIUM_AT) return "medium";
  return "low";
}

/**
 * base 50; date: available +30, open +20, limited +10, unknown/skipped/absent +5,
 * unavailable/blackout/too_soon -20; location: pass +20, risky +10, talk +5,
 * unverified/skipped/absent +5, fail -20; budget: passed +10, failed -15, skipped/absent 0;
 * alternative date chosen +15; clamped to 0..100.
 */
export function computeScore(q: Qualification): { score: number; label: ScoreLabel } {
  let score = SCORE_BASE + datePoints(q) + locationPoints(q);
  const passed = q?.budget?.passed;
  if (passed === true) score += BUDGET_PASSED_POINTS;
  else if (passed === false) score += BUDGET_FAILED_POINTS;
  if (q?.altDateChosen === true) score += ALT_DATE_POINTS;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, label: scoreLabelFor(score) };
}

/**
 * Celebrate (confetti + popup) only on real good news: the date is "available" AND, when the step
 * also checks the location, the location is pass or risky. "open" (no capacity data) never
 * celebrates. The form's own `settings.qualify.celebrate` switch is applied by the caller.
 */
export function shouldCelebrate(q: Qualification, checks: CheckKind[]): boolean {
  if (q?.date?.result !== "available") return false;
  if (Array.isArray(checks) && checks.includes("location")) {
    const r = q?.location?.result;
    return r === "pass" || r === "risky";
  }
  return true;
}
