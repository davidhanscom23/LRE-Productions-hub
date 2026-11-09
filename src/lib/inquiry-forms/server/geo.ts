import "server-only";

/**
 * Inquiry Forms - the location check (spec section 4, Location).
 *
 * Geocoder: Google Geocoding when GOOGLE_MAPS_API_KEY is set, else Nominatim (OpenStreetMap,
 * User-Agent "InquiryForms/1.0 (+<hub origin>)", requests at least 1.1 s apart per server
 * instance, and a visitor never waits behind more than a couple of queued lookups). Found places
 * are cached in inquiry_geocode_cache for good, misses for an hour. Uncached visitor lookups spend a
 * global and a per-IP hourly budget (the caller passes it), so a visitor cannot choose how many
 * billable or rate-limited calls the hub makes. Miles: Google driving distance when the key exists,
 * else straight line x roadFactor. Any failure answers "unverified" (staff confirm by hand); the
 * check never invents a pass.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyMiles, withDefaultState } from "../geo-zones";
import type { BusinessSettings, LocationResult, LocationVerdict } from "../types";
import {
  estimatedRoadMiles,
  geocodeCacheKey,
  googleConfidence,
  isGeoPoint,
  needsManualPlace,
  nominatimConfidence,
  placeConfidence,
  roundMiles,
  softenForConfidence,
  stateFromAddress,
  type GeoConfidence,
  type GeoPoint,
  type LocationInput,
} from "./geo-core";
import { TABLES } from "./schema-core";

/** A miss is kept briefly: a planted variant must not hide a real venue for days. */
const NEGATIVE_CACHE_MS = 60 * 60 * 1000;
const NOMINATIM_GAP_MS = 1100;
/** Lookups waiting or running on this instance's Nominatim queue before new ones fail fast (~3 s wait). */
const NOMINATIM_MAX_PENDING = 3;
const FETCH_TIMEOUT_MS = 8000;

interface GeoHit extends GeoPoint {
  confidence: GeoConfidence;
  display: string | null;
}

class GeocodeError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Nominatim's usage policy: at most one request per second. Calls on one instance queue here.
let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatimAt = 0;
let nominatimPending = 0;

function onNominatimQueue<T>(task: () => Promise<T>): Promise<T> {
  // A full queue answers at once (the check reads "unverified") instead of making a visitor wait
  // N x 1.1 s and time out.
  if (nominatimPending >= NOMINATIM_MAX_PENDING) {
    return Promise.reject(new GeocodeError("The geocoder is busy; the location was not checked."));
  }
  nominatimPending += 1;
  const run = nominatimQueue.then(async () => {
    const wait = lastNominatimAt + NOMINATIM_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastNominatimAt = Date.now();
    }
  });
  nominatimQueue = run.catch(() => undefined);
  return run.finally(() => {
    nominatimPending -= 1;
  });
}

async function geocodeGoogle(query: string, key: string): Promise<GeoHit | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new GeocodeError(`Google geocoding HTTP ${res.status}`);
  const body = (await res.json()) as {
    status?: string;
    results?: { geometry?: { location?: { lat?: number; lng?: number }; location_type?: string }; types?: string[]; formatted_address?: string }[];
  };
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") throw new GeocodeError(`Google geocoding status ${body.status ?? "unknown"}`);
  const first = body.results?.[0];
  const point = { lat: Number(first?.geometry?.location?.lat), lng: Number(first?.geometry?.location?.lng) };
  if (!first || !isGeoPoint(point)) return null;
  return { ...point, confidence: googleConfidence(first), display: first.formatted_address ?? null };
}

async function geocodeNominatim(query: string, origin: string): Promise<GeoHit | null> {
  return onNominatimQueue(async () => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("q", query);
    const res = await fetch(url, {
      headers: { "User-Agent": `InquiryForms/1.0 (+${origin})`, "Accept-Language": "en" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new GeocodeError(`Nominatim HTTP ${res.status}`);
    const list = (await res.json()) as { lat?: string; lon?: string; place_rank?: number; importance?: number; display_name?: string }[];
    const first = Array.isArray(list) ? list[0] : undefined;
    if (!first) return null;
    const point = { lat: Number(first.lat), lng: Number(first.lon) };
    if (!isGeoPoint(point)) return null;
    return { ...point, confidence: nominatimConfidence(first), display: first.display_name ?? null };
  });
}

export interface GeocodeOptions {
  /** Asked before an uncached network lookup; false = over budget (throws, the check reads "unverified"). */
  budget?: () => Promise<boolean>;
  /** Admin lookups (home base) ask the geocoder fresh; the answer still refreshes the cache. */
  skipCache?: boolean;
}

/** Cached geocode. null = the place was not found. Throws GeocodeError when the geocoder failed. */
export async function geocode(
  sb: SupabaseClient,
  query: string,
  origin: string,
  opts: GeocodeOptions = {},
): Promise<GeoHit | null> {
  const key = geocodeCacheKey(query);
  if (!key) return null;

  const { data: cached, error: cacheError } = opts.skipCache
    ? { data: null, error: null }
    : await sb
    .from(TABLES.geocodeCache)
    .select("lat, lng, confidence, display, created_at")
    .eq("query_key", key)
    .maybeSingle();
  if (cacheError) {
    console.error("[inquiry-forms] geocode cache read failed", cacheError.message);
  } else if (cached) {
    const row = cached as { lat: number | null; lng: number | null; confidence: string | null; display: string | null; created_at: string };
    const point = { lat: Number(row.lat), lng: Number(row.lng) };
    if (row.lat !== null && row.lng !== null && isGeoPoint(point)) {
      const confidence: GeoConfidence =
        row.confidence === "high" || row.confidence === "medium" || row.confidence === "low" ? row.confidence : "low";
      return { ...point, confidence, display: row.display };
    }
    const age = Date.now() - Date.parse(row.created_at);
    if (Number.isFinite(age) && age < NEGATIVE_CACHE_MS) return null;
  }

  if (opts.budget && !(await opts.budget())) {
    throw new GeocodeError("The hourly geocoding budget is used up; the location was not checked.");
  }
  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const hit = googleKey ? await geocodeGoogle(query, googleKey) : await geocodeNominatim(query, origin);

  const { error: writeError } = await sb.from(TABLES.geocodeCache).upsert(
    {
      query_key: key,
      lat: hit?.lat ?? null,
      lng: hit?.lng ?? null,
      confidence: hit?.confidence ?? null,
      display: hit?.display ? hit.display.slice(0, 500) : null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "query_key" },
  );
  if (writeError) console.error("[inquiry-forms] geocode cache write failed", writeError.message);
  return hit;
}

/** Google driving miles (one decimal), or null when there is no key or no route. */
async function drivingMiles(from: GeoPoint, to: GeoPoint): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${from.lat},${from.lng}`);
    url.searchParams.set("destinations", `${to.lat},${to.lng}`);
    url.searchParams.set("units", "imperial");
    url.searchParams.set("key", key);
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = (await res.json()) as { rows?: { elements?: { status?: string; distance?: { value?: number } }[] }[] };
    const element = body.rows?.[0]?.elements?.[0];
    const meters = element?.status === "OK" ? Number(element.distance?.value) : NaN;
    return Number.isFinite(meters) && meters >= 0 ? roundMiles(meters / 1609.344) : null;
  } catch (err) {
    console.error("[inquiry-forms] distance lookup failed", err instanceof Error ? err.message : err);
    return null;
  }
}

function verdict(
  business: BusinessSettings,
  result: LocationResult,
  extra: Partial<Pick<LocationVerdict, "miles" | "confidence" | "query">> = {},
): LocationVerdict {
  const messages = business.location.messages;
  const message = result === "skipped" ? "" : messages[result];
  return {
    result,
    message,
    miles: extra.miles ?? null,
    confidence: extra.confidence ?? null,
    query: extra.query ?? null,
    checkedAt: new Date().toISOString(),
  };
}

export interface LocationCheck {
  verdict: LocationVerdict;
  /** Set when something failed (the verdict is then "unverified"); the caller logs it. */
  error?: string;
}

/**
 * Check a location answer against the business home base and travel zones.
 * `input` null = the visitor gave no location. `formHasField` false = the form has no location field.
 */
export async function checkLocation(
  sb: SupabaseClient,
  business: BusinessSettings,
  input: LocationInput | null,
  opts: { formHasField: boolean; origin: string; budget?: () => Promise<boolean> },
): Promise<LocationCheck> {
  if (!business.location.enabled || !opts.formHasField) return { verdict: verdict(business, "skipped") };
  if (!input) return { verdict: verdict(business, "unverified") };
  const query = input.text;
  if (needsManualPlace(input)) return { verdict: verdict(business, "unverified", { query }) };

  try {
    const homeAddress = business.homeBase.address?.trim() ?? "";
    let home: GeoPoint | null =
      business.homeBase.lat !== null && business.homeBase.lng !== null
        ? { lat: business.homeBase.lat, lng: business.homeBase.lng }
        : null;
    if (!home || !isGeoPoint(home)) {
      home = homeAddress ? await geocode(sb, homeAddress, opts.origin, { budget: opts.budget }) : null;
      if (!home) {
        return { verdict: verdict(business, "unverified", { query }), error: "The home base address could not be placed on the map." };
      }
    }

    const state = stateFromAddress(homeAddress) ?? "FL";
    const hit = await geocode(sb, withDefaultState(query, state), opts.origin, { budget: opts.budget });
    if (!hit) return { verdict: verdict(business, "unverified", { query }) };

    const miles = (await drivingMiles(home, hit)) ?? estimatedRoadMiles(home, hit, business.location.roadFactor);
    const confidence = placeConfidence(input, hit.confidence);
    const result = softenForConfidence(classifyMiles(miles, business.location.zones), confidence);
    return { verdict: verdict(business, result, { miles, confidence, query }) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "location check failed";
    return { verdict: verdict(business, "unverified", { query }), error: message };
  }
}
