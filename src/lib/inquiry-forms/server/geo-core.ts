/**
 * Inquiry Forms - travel-zone helpers for the server. PURE (no network, no env).
 *
 * Ring classification, low-quality heuristics, state detection and haversine live in the shared
 * pure module ../geo-zones (client and server agree). This file adds what only the server needs:
 * which text to geocode, cache keys, geocoder confidence and the road-miles estimate. The network
 * side (geocoder, cache table, Google distance) lives in geo.ts.
 */
import { findRoleField, otherKey } from "../definition";
import { haversineMiles, isLowQualityAddress, isUnplaceableAddress } from "../geo-zones";
import type { Answers, FormDefinition, LocationResult } from "../types";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type GeoConfidence = "high" | "medium" | "low";

/** Location answers longer than this are cut before geocoding. */
export const LOCATION_QUERY_MAX = 300;

export function isGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== "object") return false;
  const p = value as { lat?: unknown; lng?: unknown };
  return (
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

export function roundMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}

/** Straight line x road factor (clamped to 1..3), one decimal. */
export function estimatedRoadMiles(a: GeoPoint, b: GeoPoint, roadFactor: number): number {
  const factor = Number.isFinite(roadFactor) ? Math.min(3, Math.max(1, roadFactor)) : 1.2;
  return roundMiles(haversineMiles(a.lat, a.lng, b.lat, b.lng) * factor);
}

/** Trim, collapse whitespace, cap. The text as staff will see it. */
export function cleanLocationText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, LOCATION_QUERY_MAX);
}

/**
 * Cache key: lowercase, whitespace collapsed. Punctuation stays significant: the geocoder splits
 * the query into phrases at commas, so "Casa, Monica St" is a different question from
 * "Casa Monica, St." and must never share its cached answer.
 */
export function geocodeCacheKey(query: string): string {
  return cleanLocationText(query).toLowerCase();
}

const STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC", "PR",
]);

/** Two-letter state of the business address ("..., Ponte Vedra, FL 32081" -> "FL"). */
export function stateFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const matches = address.match(/\b[A-Z]{2}\b(?=\s*\d{5}|\s*$|\s*,)/g) ?? [];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    if (STATE_CODES.has(matches[i])) return matches[i];
  }
  return null;
}

/** Nominatim (jsonv2) place_rank -> confidence: 26+ street/building/venue, 18+ town/suburb, else city/county/state. */
export function nominatimConfidence(result: { place_rank?: unknown; importance?: unknown }): GeoConfidence {
  const rank = typeof result.place_rank === "number" ? result.place_rank : Number(result.place_rank);
  if (Number.isFinite(rank)) {
    if (rank >= 26) return "high";
    if (rank >= 18) return "medium";
    return "low";
  }
  const importance = typeof result.importance === "number" ? result.importance : 0;
  if (importance > 0.7) return "high";
  if (importance < 0.3) return "low";
  return "medium";
}

const GOOGLE_PRECISE = new Set([
  "street_address",
  "premise",
  "subpremise",
  "establishment",
  "point_of_interest",
  "park",
  "airport",
  "intersection",
]);
const GOOGLE_AREA = new Set(["route", "neighborhood", "sublocality", "sublocality_level_1"]);

/** Google Geocoding result -> confidence (LeadGate ladder). */
export function googleConfidence(result: { types?: unknown; geometry?: { location_type?: unknown } }): GeoConfidence {
  const locationType = String(result.geometry?.location_type ?? "");
  const types = Array.isArray(result.types) ? result.types.map(String) : [];
  if (locationType === "ROOFTOP") return "high";
  if (locationType === "APPROXIMATE") return "low";
  if (types.some((t) => GOOGLE_PRECISE.has(t))) {
    return locationType === "GEOMETRIC_CENTER" ? "medium" : "high";
  }
  if (locationType === "RANGE_INTERPOLATED") return "medium";
  if (types.some((t) => GOOGLE_AREA.has(t))) return "medium";
  return "low";
}

/**
 * A fuzzy match never rejects a visitor: a "fail" on a low-confidence point becomes
 * "unverified" (staff confirm by hand).
 */
export function softenForConfidence(result: LocationResult, confidence: GeoConfidence | null): LocationResult {
  if (result === "fail" && confidence === "low") return "unverified";
  return result;
}

export interface LocationInput {
  /** What the visitor typed, or the option label they picked (cleaned). */
  text: string;
  /** true when the text is an admin-written option label (never treated as low quality). */
  fromOption: boolean;
}

/**
 * The location answer of the event_location role field: typed text for text/address fields; the
 * option LABEL for select/radio fields (or the "Other" text when that option is picked).
 * null when the form has no location field or the answer is empty.
 */
export function locationInputFromAnswers(def: FormDefinition, answers: Answers): LocationInput | null {
  const field = findRoleField(def, "event_location");
  if (!field) return null;
  const value = answers[field.key];
  if (typeof value !== "string" || !value.trim()) return null;
  if (field.type === "select" || field.type === "radio") {
    const choice = (field.choices ?? []).find((c) => c.value === value);
    if (!choice) return null;
    if (choice.isOther) {
      const other = answers[otherKey(field.key)];
      const text = typeof other === "string" ? cleanLocationText(other) : "";
      return text ? { text, fromOption: false } : null;
    }
    const text = cleanLocationText(choice.label || value);
    return text ? { text, fromOption: true } : null;
  }
  const text = cleanLocationText(value);
  return text ? { text, fromOption: false } : null;
}

/** Whether the form has a location field at all (no field = the location check is skipped). */
export function formHasLocationField(def: FormDefinition): boolean {
  return Boolean(findRoleField(def, "event_location"));
}

/**
 * Visitor text with nothing to look up ("TBD", "my house", "church") goes straight to
 * "unverified" (no network call). A city-only answer is still looked up (see placeConfidence).
 */
export function needsManualPlace(input: LocationInput): boolean {
  return !input.fromOption && isUnplaceableAddress(input.text);
}

/**
 * A rough visitor answer (city only, venue name only) is placed at LOW confidence whatever the
 * geocoder says, so softenForConfidence turns a far "fail" into "unverified" for staff to confirm.
 * Option labels and full addresses keep the geocoder's confidence.
 */
export function placeConfidence(input: LocationInput, confidence: GeoConfidence): GeoConfidence {
  return !input.fromOption && isLowQualityAddress(input.text) ? "low" : confidence;
}
