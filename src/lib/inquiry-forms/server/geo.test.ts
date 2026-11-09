import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import { geocode } from "./geo";
import { geocodeCacheKey } from "./geo-core";

interface CacheRow {
  query_key: string;
  lat: number | null;
  lng: number | null;
  confidence: string | null;
  display: string | null;
  created_at: string;
}

/** The two calls geocode() makes on inquiry_geocode_cache: select ... eq ... maybeSingle, and upsert. */
function fakeCache(rows: Map<string, CacheRow>): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          maybeSingle: async () => ({ data: rows.get(key) ?? null, error: null }),
        }),
      }),
      upsert: async (row: CacheRow) => {
        rows.set(row.query_key, row);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
}

const FOUND = [{ lat: "29.89", lon: "-81.31", place_rank: 30, importance: 0.5, display_name: "Casa Monica" }];

describe("geocode", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("keeps a 'not found' for an hour, not a week, so a planted miss cannot hide a venue for days", async () => {
    const rows = new Map<string, CacheRow>();
    const key = geocodeCacheKey("Nowhere Hall");
    rows.set(key, { query_key: key, lat: null, lng: null, confidence: null, display: null, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() });
    fetchMock.mockResolvedValue(new Response(JSON.stringify(FOUND), { status: 200 }));
    const hit = await geocode(fakeCache(rows), "Nowhere Hall", "https://hub.example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hit?.lat).toBeCloseTo(29.89);
  });

  it("asks the budget before any network lookup and makes none when it is used up", async () => {
    const rows = new Map<string, CacheRow>();
    const budget = vi.fn().mockResolvedValue(false);
    await expect(geocode(fakeCache(rows), "Casa Monica", "https://hub.example.com", { budget })).rejects.toThrow(/budget/i);
    expect(budget).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never spends the budget on a cached answer", async () => {
    const rows = new Map<string, CacheRow>();
    const key = geocodeCacheKey("Casa Monica");
    rows.set(key, { query_key: key, lat: 29.89, lng: -81.31, confidence: "high", display: "Casa Monica", created_at: new Date().toISOString() });
    const budget = vi.fn().mockResolvedValue(false);
    const hit = await geocode(fakeCache(rows), "Casa Monica", "https://hub.example.com", { budget });
    expect(hit?.confidence).toBe("high");
    expect(budget).not.toHaveBeenCalled();
  });

  it("lets the admin home-base lookup skip the cache", async () => {
    const rows = new Map<string, CacheRow>();
    const key = geocodeCacheKey("101 Marketside Avenue, Ponte Vedra, FL");
    rows.set(key, { query_key: key, lat: null, lng: null, confidence: null, display: null, created_at: new Date().toISOString() });
    fetchMock.mockResolvedValue(new Response(JSON.stringify(FOUND), { status: 200 }));
    const hit = await geocode(fakeCache(rows), "101 Marketside Avenue, Ponte Vedra, FL", "https://hub.example.com", { skipCache: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hit).not.toBeNull();
  });

  it("fails fast instead of queueing a visitor behind a pile of Nominatim lookups", async () => {
    const rows = new Map<string, CacheRow>();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    fetchMock.mockImplementation(async () => {
      await gate;
      return new Response(JSON.stringify(FOUND), { status: 200 });
    });
    const sb = fakeCache(rows);
    const calls = Array.from({ length: 6 }, (_, i) => geocode(sb, `Venue number ${i}`, "https://hub.example.com"));
    const settled = await Promise.race([
      Promise.allSettled(calls.slice(3)),
      new Promise<"stuck">((r) => setTimeout(() => r("stuck"), 500)),
    ]);
    release();
    expect(settled).not.toBe("stuck");
    for (const r of settled as PromiseSettledResult<unknown>[]) {
      expect(r.status).toBe("rejected");
      expect(String((r as PromiseRejectedResult).reason)).toMatch(/busy/i);
    }
    await Promise.allSettled(calls);
  }, 15_000);
});

describe("geocode cache key", () => {
  it("keeps commas and periods, which split the geocoder's query into phrases", () => {
    expect(geocodeCacheKey("Casa Monica, St. Augustine, FL")).not.toBe(geocodeCacheKey("Casa, Monica St, Augustine, FL"));
    expect(geocodeCacheKey("Casa Monica, St. Augustine, FL")).not.toBe(geocodeCacheKey("Casa.Monica.St.Augustine, FL"));
    expect(geocodeCacheKey("  Casa   Monica, ST. Augustine ")).toBe(geocodeCacheKey("casa monica, st. augustine"));
  });
});
