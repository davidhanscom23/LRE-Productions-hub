import { describe, expect, it } from "vitest";
import {
  CRM_WORDS,
  attributionRows,
  formatYmd,
  isStageFilter,
  logKindLabel,
  mailtoHref,
  sourceSummary,
  splitAnswerLine,
} from "./submissions-format";

describe("sourceSummary", () => {
  it("prefers UTM source and medium", () => {
    expect(sourceSummary({ utm_source: "google", utm_medium: "cpc", gclid: "x", host_domain: "example.com" })).toBe(
      "google / cpc",
    );
  });
  it("names ad click ids when there is no UTM", () => {
    expect(sourceSummary({ gclid: "abc" })).toBe("Google Ads");
    expect(sourceSummary({ fbclid: "abc" })).toBe("Facebook or Instagram ad");
    expect(sourceSummary({ msclkid: "abc" })).toBe("Microsoft Ads");
  });
  it("falls back to the host site, then the referrer, then Direct", () => {
    expect(sourceSummary({ host_domain: "www.example.com", referrer: "https://www.instagram.com/x" })).toBe(
      "example.com (from instagram.com)",
    );
    expect(sourceSummary({ referrer: "https://www.google.com/" })).toBe("google.com");
    expect(sourceSummary({})).toBe("Direct");
    expect(sourceSummary(null)).toBe("Direct");
  });
});

describe("splitAnswerLine", () => {
  it("splits on the first colon-space only", () => {
    expect(splitAnswerLine("Start and end time: 6:00 PM - 11:00 PM")).toEqual({
      label: "Start and end time",
      value: "6:00 PM - 11:00 PM",
    });
    expect(splitAnswerLine("No label here")).toEqual({ label: "", value: "No label here" });
  });
});

describe("formatYmd", () => {
  it("never shifts a wall date (no Date parsing)", () => {
    expect(formatYmd("2027-05-15")).toBe("May 15, 2027");
    expect(formatYmd("2026-01-01")).toBe("Jan 1, 2026");
  });
  it("returns odd input unchanged and empty for nothing", () => {
    expect(formatYmd("next spring")).toBe("next spring");
    expect(formatYmd(null)).toBe("");
  });
});

describe("logKindLabel", () => {
  it("labels the server log kinds and humanizes unknown ones", () => {
    // The CRM labels are this hub's words (hub-copy.ts); the rest are shared.
    expect(logKindLabel("crm_record")).toBe(CRM_WORDS.logRecord);
    expect(logKindLabel("crm_manual")).toBe(CRM_WORDS.logManual);
    expect(CRM_WORDS.logRecord.trim()).not.toBe("");
    expect(logKindLabel("staff_email")).toBe("Staff email");
    expect(logKindLabel("abandon_alert")).toBe("Unfinished inquiry alert");
    expect(logKindLabel("brand_new_kind")).toBe("Brand new kind");
    expect(logKindLabel("")).toBe("Activity");
  });
});

describe("attributionRows", () => {
  it("links only http(s) URLs (a javascript: referrer must stay plain text)", () => {
    const rows = attributionRows({
      page_url: "https://example.com/contact?utm_source=google",
      referrer: "javascript:alert(1)",
      utm_source: "google",
    });
    expect(rows.find((r) => r.label === "Page")?.href).toBe("https://example.com/contact?utm_source=google");
    const ref = rows.find((r) => r.label === "Came from");
    expect(ref?.value).toBe("javascript:alert(1)");
    expect(ref?.href).toBeUndefined();
  });
  it("skips empty values", () => {
    expect(attributionRows({ utm_source: "  ", gclid: "" })).toEqual([]);
  });
});

describe("isStageFilter", () => {
  it("accepts the six filters only", () => {
    for (const v of ["all", "completed", "waitlisted", "in_progress", "abandoned", "spam"]) expect(isStageFilter(v)).toBe(true);
    expect(isStageFilter("deleted")).toBe(false);
    expect(isStageFilter(undefined)).toBe(false);
  });
});

describe("mailtoHref", () => {
  it("percent-encodes the address so stored characters can never add mailto headers", () => {
    expect(mailtoHref("ann.lee+events@example.com")).toBe("mailto:ann.lee%2Bevents@example.com");
    // An address stored before the stricter email rule: the ? and & stay inside the address.
    const href = mailtoHref("lead@example.com?bcc=attacker%40evil.test&body=hi");
    expect(href.startsWith("mailto:")).toBe(true);
    expect(href.slice("mailto:".length)).not.toMatch(/[?&]/);
  });
});
