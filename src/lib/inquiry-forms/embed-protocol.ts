/**
 * Inquiry Forms - the postMessage protocol between /inquire/[slug]?embed=1 and /inquire/embed.js,
 * redirect URL safety, and attribution parsing.
 *
 * PURE module. Both sides must ALSO check `e.origin` and `e.source` on every message; these guards
 * check the payload shape (source + v + type + typed fields) so a message from any other frame
 * (ads, chat widgets, LeadGate's old `leadgate-*` messages) is ignored.
 */

import {
  EMBED_HOST_SOURCE,
  EMBED_MESSAGE_SOURCE,
  type Attribution,
  type FormToHostMessage,
  type HostToFormMessage,
} from "./types";
import { isValidSlug } from "./slug";

/** The host clamps reported heights to this range (spec: 200..6000). */
export const EMBED_HEIGHT_MIN = 200;
export const EMBED_HEIGHT_MAX = 6000;

/** Clamp a reported height for the iframe style (non-numbers give the minimum). */
export function clampEmbedHeight(height: number): number {
  if (typeof height !== "number" || !Number.isFinite(height)) return EMBED_HEIGHT_MIN;
  return Math.min(EMBED_HEIGHT_MAX, Math.max(EMBED_HEIGHT_MIN, Math.ceil(height)));
}

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/** True for a well-formed form -> host message (objects only; JSON strings are not accepted). */
export function isFormMessage(data: unknown): data is FormToHostMessage {
  if (!isRecord(data)) return false;
  if (data.source !== EMBED_MESSAGE_SOURCE || data.v !== 1) return false;
  if (typeof data.slug !== "string" || !isValidSlug(data.slug)) return false;
  switch (data.type) {
    case "ready":
      return true;
    case "height":
      return typeof data.height === "number" && Number.isFinite(data.height) && data.height >= 0;
    case "step":
      return isNonNegativeInt(data.index) && isNonNegativeInt(data.total) && data.total >= 1 && data.index < data.total;
    case "submitted":
      return (data.ending === "completed" || data.ending === "waitlisted") && typeof data.formName === "string";
    case "redirect":
      return typeof data.url === "string" && data.url.length > 0;
    default:
      return false;
  }
}

/** True for a well-formed host -> form message (only the redirect ack exists). */
export function isHostMessage(data: unknown): data is HostToFormMessage {
  return isRecord(data) && data.source === EMBED_HOST_SOURCE && data.v === 1 && data.type === "redirect-ack";
}

/**
 * A redirect target that is safe to navigate to: an absolute http(s) URL with a host and no
 * user:password part. Returns the normalized URL, or null (relative, protocol-relative,
 * javascript:, data:, blob:, malformed, longer than 2048 characters).
 */
export function safeRedirectUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const s = url.trim();
  if (!s || s.length > 2048 || !/^https?:\/\//i.test(s)) return null;
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname || parsed.username || parsed.password) return null;
  return parsed.href;
}

const PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
] as const;

const PARAM_MAX = 500;
const URL_MAX = 2000;

/** Strip control characters, trim, cap. */
function cleanValue(v: string, max: number): string {
  let out = "";
  for (const ch of v) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) continue;
    out += ch;
  }
  return out.trim().slice(0, max);
}

/** Query params by lowercased name (first non-empty value wins). Accepts "?a=1", "a=1" or a full URL. */
function paramsOf(query: string): Map<string, string> {
  const map = new Map<string, string>();
  if (typeof query !== "string" || !query) return map;
  let q = query;
  const hashAt = q.indexOf("#");
  if (hashAt >= 0) q = q.slice(0, hashAt);
  const qAt = q.indexOf("?");
  if (qAt >= 0) q = q.slice(qAt + 1);
  if (!q.includes("=")) return map;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(q);
  } catch {
    return map;
  }
  params.forEach((value, name) => {
    const key = name.trim().toLowerCase();
    const v = cleanValue(value, PARAM_MAX);
    if (key && v && !map.has(key)) map.set(key, v);
  });
  return map;
}

/** The query-like part of a hash: "#utm_source=x" or "#/page?utm_source=x"; "" when none. */
function hashQuery(hash: string): string {
  if (typeof hash !== "string" || !hash) return "";
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const qAt = h.indexOf("?");
  if (qAt >= 0) return h.slice(qAt + 1);
  return h.includes("=") ? h : "";
}

/** An absolute http(s) URL with its #fragment removed (fragments can carry tokens), or null. */
function httpUrl(u: string): URL | null {
  if (typeof u !== "string" || !u.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(u.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  parsed.hash = "";
  return parsed;
}

/**
 * Attribution for a submission: UTM tags and click ids from the query string AND the hash (query
 * wins), plus the page URL (query kept, fragment dropped), its host, and the referrer.
 * `landing_url` (first touch) is not derivable here; the embed script adds it from localStorage.
 */
export function parseAttribution(search: string, hash: string, referrer: string, pageUrl: string): Attribution {
  const out: Attribution = {};
  const fromQuery = paramsOf(search);
  const fromHash = paramsOf(hashQuery(hash));
  for (const key of PARAM_KEYS) {
    const v = fromQuery.get(key) ?? fromHash.get(key);
    if (v) out[key] = v;
  }
  const page = httpUrl(pageUrl);
  if (page) {
    out.page_url = page.href.slice(0, URL_MAX);
    out.host_domain = page.hostname.toLowerCase();
  }
  const ref = httpUrl(referrer);
  if (ref) out.referrer = ref.href.slice(0, URL_MAX);
  return out;
}
