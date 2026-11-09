/**
 * Inquiry Forms - spam signals, fixed-window keys and request metadata. PURE.
 *
 * The spam verdict is computed once per submission (start: honeypot, fill time, starts per IP
 * hash per hour; complete: completes per email per day, optional Turnstile). A spam submission is
 * stored with stage "spam", every outbound message is silenced, and the bot still sees a normal
 * thank-you.
 */
import { ATTRIBUTION_KEYS, type Attribution, type BusinessSettings } from "../types";

/** Bots post instantly; a human needs longer than this between first render and Next. */
export const MIN_FILL_MS = 2500;
export const ATTRIBUTION_VALUE_MAX = 500;
export const USER_AGENT_MAX = 300;

export type SpamReason =
  | "honeypot"
  | "too_fast"
  | "ip_rate"
  | "email_rate"
  | "turnstile_failed"
  | "turnstile_missing";

/** Honeypot and fill-time signals (no DB needed). */
export function startSignalsSpamReason(input: { hp: unknown; elapsedMs: unknown }): SpamReason | null {
  if (typeof input.hp === "string" && input.hp.trim() !== "") return "honeypot";
  if (input.hp !== undefined && input.hp !== null && typeof input.hp !== "string") return "honeypot";
  const elapsed = typeof input.elapsedMs === "number" && Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0;
  if (elapsed < MIN_FILL_MS) return "too_fast";
  return null;
}

/** null count = the counter could not be read: never call that spam (fail open on infrastructure). */
export function overLimit(count: number | null, max: number): boolean {
  if (count === null || !Number.isFinite(count)) return false;
  if (!Number.isFinite(max) || max <= 0) return false;
  return count > max;
}

/**
 * Visitor confirmation emails per IP hash per New York day. Once a form turns the confirmation on,
 * this keeps the form from mailing any address a script types, many times over, from one network.
 */
export const MAX_CONFIRMATIONS_PER_IP_PER_DAY = 5;

/** Past this multiple of the per-IP start limit a start is refused (429) and nothing is stored. */
export const START_HARD_CAP_FACTOR = 3;

/**
 * The per-IP limit only labels a start spam (the bot still sees a session); past 3x the limit the
 * start is refused outright, so a script cannot grow the hub's database without bound.
 */
export function startHardCapped(count: number | null, maxPerHour: number): boolean {
  return overLimit(count, maxPerHour * START_HARD_CAP_FACTOR);
}

export type TurnstileDecision =
  | { action: "accept" }
  | { action: "accept_logged" }
  | { action: "retry" }
  | { action: "spam"; reason: SpamReason };

/**
 * What a Turnstile outcome means for the request. A missing token is never silent spam: a real
 * visitor whose check did not finish (blocked script, an unticked box, a page loaded before the
 * check was turned on) is told to finish it and try again, and nothing is stored.
 */
export function turnstileDecision(outcome: TurnstileOutcome | "missing"): TurnstileDecision {
  if (outcome === "pass") return { action: "accept" };
  if (outcome === "error") return { action: "accept_logged" };
  if (outcome === "missing") return { action: "retry" };
  return { action: "spam", reason: "turnstile_failed" };
}

/**
 * The per-email completes counter counts each submission once (first hit of its once-key). Retries
 * and double clicks of the same inquiry never push the visitor over the limit.
 */
export function countsTowardEmailLimit(onceHits: number | null): boolean {
  return onceHits === null || onceHits <= 1;
}

// ---------------------------------------------------------------------------
// Fixed windows (inquiry_rate_limits.window_start)
// ---------------------------------------------------------------------------

function floorTo(now: Date, ms: number): string {
  return new Date(Math.floor(now.getTime() / ms) * ms).toISOString();
}

/** Start of the current clock hour (whole hours are the same in UTC and New York). */
export function hourWindowStart(now: Date): string {
  return floorTo(now, 60 * 60 * 1000);
}

/** Start of the current half hour. */
export function halfHourWindowStart(now: Date): string {
  return floorTo(now, 30 * 60 * 1000);
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

function nyParts(d: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const p: Record<string, string> = {};
  for (const part of NY_PARTS.formatToParts(d)) p[part.type] = part.value;
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute) };
}

/** The UTC instant of midnight in New York at the start of the New York day that contains `now`. */
export function easternDayWindowStart(now: Date): string {
  const p = nyParts(now);
  // New York is UTC-4 (EDT) or UTC-5 (EST); midnight is never inside a DST jump (those happen at 2 AM).
  for (const offsetHours of [4, 5]) {
    const candidate = new Date(Date.UTC(p.y, p.mo - 1, p.d, offsetHours, 0, 0));
    const c = nyParts(candidate);
    if (c.y === p.y && c.mo === p.mo && c.d === p.d && c.h === 0 && c.mi === 0) {
      return candidate.toISOString();
    }
  }
  // Unreachable for America/New_York; keep a sane value instead of throwing.
  return new Date(Date.UTC(p.y, p.mo - 1, p.d, 5, 0, 0)).toISOString();
}

export const RATE_KEYS = {
  starts: (ipHash: string | null) => `start:${ipHash ?? "no-ip"}`,
  completes: (emailHash: string) => `complete:${emailHash}`,
  completeOnce: (submissionId: string) => `complete-once:${submissionId}`,
  geocodeAll: () => "geocode:all",
  geocodeIp: (ipHash: string | null) => `geocode:ip:${ipHash ?? "no-ip"}`,
  confirmations: (ipHash: string | null) => `confirm:${ipHash ?? "no-ip"}`,
  view: (formId: string, ipHash: string | null) => `view:${formId}:${ipHash ?? "no-ip"}`,
  qualify: (submissionId: string) => `qualify:${submissionId}`,
  preview: (adminId: string) => `preview:${adminId}`,
} as const;

// ---------------------------------------------------------------------------
// Request metadata
// ---------------------------------------------------------------------------

/** Known attribution keys only, strings only, control characters removed, each capped. */
export function sanitizeAttribution(raw: unknown): Attribution {
  const out: Attribution = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const source = raw as Record<string, unknown>;
  for (const key of ATTRIBUTION_KEYS) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, ATTRIBUTION_VALUE_MAX);
    if (clean) out[key] = clean;
  }
  return out;
}

/** First hop of x-forwarded-for (Vercel sets it), else x-real-ip. */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : null;
}

export function capUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const clean = ua.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean ? clean.slice(0, USER_AGENT_MAX) : null;
}

// ---------------------------------------------------------------------------
// Cloudflare Turnstile (optional)
// ---------------------------------------------------------------------------

export interface TurnstileEnv {
  TURNSTILE_SECRET_KEY?: string | undefined;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string | undefined;
}

/** On only when BOTH keys exist and the business settings toggle is on. */
export function turnstileEnabled(env: TurnstileEnv, business: Pick<BusinessSettings, "spam">): boolean {
  return Boolean(
    env.TURNSTILE_SECRET_KEY?.trim() && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() && business.spam?.turnstile,
  );
}

export type TurnstileOutcome = "pass" | "fail" | "error";

/** Cloudflare siteverify JSON -> outcome. Anything unreadable is "error" (never spam by itself). */
export function readTurnstileResult(json: unknown): TurnstileOutcome {
  if (!json || typeof json !== "object") return "error";
  const body = json as { success?: unknown; "error-codes"?: unknown };
  if (body.success === true) return "pass";
  const codes = Array.isArray(body["error-codes"]) ? body["error-codes"].map(String) : [];
  // Our own misconfiguration or Cloudflare trouble is not the visitor's fault.
  if (codes.some((c) => c === "missing-input-secret" || c === "invalid-input-secret" || c === "internal-error")) {
    return "error";
  }
  return body.success === false ? "fail" : "error";
}
