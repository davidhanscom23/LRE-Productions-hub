import { describe, expect, it } from "vitest";
import { isValidSlug } from "@/lib/inquiry-forms/slug";
import {
  addStats,
  checkFormName,
  copyName,
  easternMidnightIso,
  emptyStats,
  sameInstant,
  formatPercent,
  isMissingTableError,
  isUniqueViolation,
  nextAvailableSlug,
  percentOf,
} from "./list-helpers";
import type { FormStats } from "./list-types";

describe("percentOf / formatPercent", () => {
  it("rounds to one decimal and hides .0", () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(formatPercent(percentOf(1, 3))).toBe("33.3%");
    expect(formatPercent(percentOf(1, 4))).toBe("25%");
  });
  it("returns null (shown as -) when there is nothing to divide by", () => {
    expect(percentOf(5, 0)).toBeNull();
    expect(formatPercent(null)).toBe("-");
  });
});

describe("addStats", () => {
  it("sums rows and treats missing counts as 0", () => {
    const total = [{ views: 3, starts: 2, completes: 1 }, { views: 4 }, { views: null, starts: "2" }].reduce<FormStats>(
      (acc, row) => addStats(acc, row),
      emptyStats(),
    );
    expect(total).toEqual({ views: 7, starts: 4, completes: 1 });
  });
});

describe("isMissingTableError (Inquiry Forms migration not run)", () => {
  it("detects Postgres 42P01 and PostgREST PGRST205 / PGRST202", () => {
    expect(isMissingTableError({ code: "42P01", message: 'relation "public.inquiry_forms" does not exist' })).toBe(true);
    expect(
      isMissingTableError({ code: "PGRST205", message: "Could not find the table 'public.inquiry_forms' in the schema cache" }),
    ).toBe(true);
    expect(isMissingTableError({ code: "PGRST202", message: "Could not find the function public.inquiry_stat_bump" })).toBe(true);
    expect(isMissingTableError({ message: 'relation "inquiry_settings" does not exist' })).toBe(true);
  });
  it("does not mistake other errors for a missing migration", () => {
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isMissingTableError({ code: "42501", message: "permission denied for table inquiry_forms" })).toBe(false);
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "42P01" })).toBe(false);
  });
});

describe("nextAvailableSlug", () => {
  it("keeps the base when free and counts up when taken", () => {
    expect(nextAvailableSlug("check-your-date", [])).toBe("check-your-date");
    expect(nextAvailableSlug("check-your-date", ["check-your-date"])).toBe("check-your-date-2");
    expect(nextAvailableSlug("check-your-date", ["check-your-date", "check-your-date-2"])).toBe("check-your-date-3");
  });
  it("stays a valid slug of at most 60 characters", () => {
    const base = `${"a".repeat(58)}-b`;
    expect(base.length).toBe(60);
    const next = nextAvailableSlug(base, [base]);
    expect(next.length).toBeLessThanOrEqual(60);
    expect(isValidSlug(next)).toBe(true);
    expect(next.endsWith("-2")).toBe(true);
  });
});

describe("copyName", () => {
  it("adds (copy), then (copy 2) when that name exists", () => {
    expect(copyName("Check Your Date", ["Check Your Date"])).toBe("Check Your Date (copy)");
    expect(copyName("Check Your Date", ["Check Your Date", "check your date (copy)"])).toBe("Check Your Date (copy 2)");
  });
  it("copies of a copy do not stack suffixes", () => {
    expect(copyName("Check Your Date (copy)", ["Check Your Date (copy)"])).toBe("Check Your Date (copy 2)");
  });
});

describe("sameInstant", () => {
  it("matches Postgres and ISO spellings of the same moment", () => {
    expect(sameInstant("2026-11-04 13:12:45.123456+00", "2026-11-04T13:12:45.123Z")).toBe(true);
    expect(sameInstant("2026-11-04T13:12:45.123456+00:00", "2026-11-04T13:12:45.123456+00:00")).toBe(true);
  });
  it("rejects different moments and junk", () => {
    expect(sameInstant("2026-11-04T13:12:45.123Z", "2026-11-04T13:12:45.125Z")).toBe(false);
    expect(sameInstant("", "2026-11-04T13:12:45Z")).toBe(false);
    expect(sameInstant(undefined, undefined)).toBe(false);
  });
});

describe("easternMidnightIso", () => {
  it("uses EDT (-04:00) in summer and EST (-05:00) in winter", () => {
    expect(easternMidnightIso("2026-07-04")).toBe("2026-07-04T04:00:00.000Z");
    expect(easternMidnightIso("2026-12-01")).toBe("2026-12-01T05:00:00.000Z");
  });
  it("handles the DST change days", () => {
    expect(easternMidnightIso("2026-03-08")).toBe("2026-03-08T05:00:00.000Z");
    expect(easternMidnightIso("2026-11-01")).toBe("2026-11-01T04:00:00.000Z");
  });
});

describe("checkFormName", () => {
  it("trims and collapses spaces", () => {
    expect(checkFormName("  Wedding   inquiry ")).toEqual({ ok: true, name: "Wedding inquiry" });
  });
  it("rejects empty and too long names", () => {
    expect(checkFormName("   ").ok).toBe(false);
    expect(checkFormName(123).ok).toBe(false);
    expect(checkFormName("x".repeat(121)).ok).toBe(false);
  });
});
