/**
 * Inquiry Forms - service-area rings and address-quality heuristics.
 *
 * PURE module. Rings (miles from the home base):
 *   pass  <= passMiles  < risky <= riskyMiles <  talk <= talkMiles
 *   beyond talkMiles: "talk" when maxMiles is null (never turn anyone away), else "fail".
 * The three ring thresholds are sorted defensively (an admin typo like pass 90 / risky 60 must not
 * invert the map), and a set maxMiles is also a hard cap: anything farther than it is "fail".
 */

import type { BusinessSettings, LocationResult } from "./types";

type Zones = BusinessSettings["location"]["zones"];

function cleanThreshold(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Classify a distance. Invalid distances (negative, NaN, Infinity) are "unverified". */
export function classifyMiles(miles: number, zones: Zones): LocationResult {
  if (typeof miles !== "number" || !Number.isFinite(miles) || miles < 0) return "unverified";
  const [pass, risky, talk] = [
    cleanThreshold(zones?.passMiles),
    cleanThreshold(zones?.riskyMiles),
    cleanThreshold(zones?.talkMiles),
  ].sort((a, b) => a - b);
  const max = zones?.maxMiles;
  const hasMax = typeof max === "number" && Number.isFinite(max) && max >= 0;
  if (hasMax && miles > max) return "fail";
  if (miles <= pass) return "pass";
  if (miles <= risky) return "risky";
  if (miles <= talk) return "talk";
  return hasMax ? "fail" : "talk";
}

const STARTS_VAGUE = /^(my|the|our)\s+(house|place|home|location|venue|spot|address)\b/i;
// \b matters: without it "na" flagged every "Naples, FL" and "Nashville" (LeadGate pattern bug).
const STARTS_UNKNOWN = /^(undetermined|unknown|tbd|tba|n\/a|na|not sure|idk|somewhere|anywhere)\b/i;
const BARE_POSSESSIVE = /^[a-z]+['’]s$/i;
const BARE_PLACE_WORD = /^(home|here|there|office|work|church|school)$/i;

/**
 * LeadGate's low-quality address heuristics (study 2 sec 8.5, study 3 sec 4.11): too short
 * (under 8 characters), "my house" / "the venue" style, "TBD" / "not sure" style, a bare
 * possessive ("Wendy's"), a bare place word ("church"), digits only, symbols only, or no digits and
 * fewer than 3 words ("Jacksonville FL", "Casa Monica"). A city-level answer is low quality on
 * purpose: it can be geocoded, but only roughly.
 */
export function isLowQualityAddress(text: string): boolean {
  const t = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (t.length < 8) return true;
  if (STARTS_VAGUE.test(t)) return true;
  if (STARTS_UNKNOWN.test(t)) return true;
  if (BARE_POSSESSIVE.test(t)) return true;
  if (BARE_PLACE_WORD.test(t)) return true;
  if (/^\d+$/.test(t.replace(/\s/g, ""))) return true;
  if (!/[\p{L}\p{N}]/u.test(t)) return true;
  const hasDigit = /\d/.test(t);
  const words = t.split(/[\s,]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!hasDigit && words.length < 3) return true;
  return false;
}

/**
 * The part of the heuristics that means "nothing to look up": "TBD" / "not sure", "my house",
 * a bare possessive or place word, digits or symbols only, under 3 characters. Unlike
 * isLowQualityAddress, a short city answer ("St. Augustine", "Orlando, FL") is NOT unplaceable:
 * it can be geocoded roughly, which is enough for a miles ring.
 */
export function isUnplaceableAddress(text: string): boolean {
  const t = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (t.length < 3) return true;
  if (STARTS_VAGUE.test(t)) return true;
  if (STARTS_UNKNOWN.test(t)) return true;
  if (BARE_POSSESSIVE.test(t)) return true;
  if (BARE_PLACE_WORD.test(t)) return true;
  if (/^\d+$/.test(t.replace(/\s/g, ""))) return true;
  if (!/\p{L}/u.test(t)) return true;
  return false;
}

const US_STATE_NAMES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
  "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
  "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
  "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
  "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
  "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
  "virginia", "washington", "west virginia", "wisconsin", "wyoming", "district of columbia",
  "puerto rico",
];

const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC", "PR",
];

/** State codes that are also everyday words or abbreviations; only trusted at the end of the text. */
const WORDLIKE_CODES = new Set(["IN", "OR", "ME", "OK", "HI", "DE", "PA", "MA", "LA", "OH", "ID", "CO", "AL"]);

const STATE_NAME_RE = new RegExp(`\\b(${US_STATE_NAMES.join("|")})\\b`, "i");
const STATE_CODE_UPPER_RE = new RegExp(`\\b(${US_STATE_CODES.filter((c) => !WORDLIKE_CODES.has(c)).join("|")})\\b`);
const STATE_CODE_AT_END_RE = new RegExp(`(?:^|[\\s,])(${US_STATE_CODES.join("|")})\\.?(?:\\s+\\d{5}(?:-\\d{4})?)?\\s*$`, "i");

/**
 * True when the text already names a US state: a full state name anywhere, an UPPERCASE code
 * anywhere ("Orlando FL near the beach"; word-like codes such as IN or OR excluded there), or a
 * code in any case at the end ("jacksonville fl 32202").
 */
export function mentionsUsState(text: string): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  return STATE_NAME_RE.test(text) || STATE_CODE_UPPER_RE.test(text) || STATE_CODE_AT_END_RE.test(text.trim());
}

/** Append ", <state>" (e.g. "FL") for geocoding when the text names no US state. */
export function withDefaultState(text: string, state: string): string {
  const t = typeof text === "string" ? text.trim() : "";
  if (!t || !state || mentionsUsState(t)) return t;
  return `${t}, ${state}`;
}

/** Straight-line distance in miles between two lat/lng points (haversine). */
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.7613 * Math.asin(Math.min(1, Math.sqrt(a)));
}
