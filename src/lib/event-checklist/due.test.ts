import { describe, expect, it } from "vitest";
import { alertBody, alertSms, alertTitle, isDueNow, isStale } from "./due";

const now = new Date("2026-11-10T18:00:00Z");

describe("isDueNow", () => {
  it("is false before the time and when there is no time", () => {
    expect(isDueNow(now, "2026-11-10T18:00:01Z")).toBe(false);
    expect(isDueNow(now, null)).toBe(false);
    expect(isDueNow(now, "not a date")).toBe(false);
  });
  it("is true from the scheduled time until the window ends", () => {
    expect(isDueNow(now, "2026-11-10T18:00:00Z")).toBe(true);
    expect(isDueNow(now, "2026-11-10T07:00:00Z")).toBe(true);
    expect(isDueNow(now, "2026-11-10T05:59:00Z")).toBe(false);
  });
  it("honors a longer window for the popup", () => {
    expect(isDueNow(now, "2026-11-09T00:00:00Z", 48)).toBe(true);
  });
});

describe("isStale", () => {
  it("only flags times older than the window", () => {
    expect(isStale(now, "2026-11-10T05:00:00Z")).toBe(true);
    expect(isStale(now, "2026-11-10T12:00:00Z")).toBe(false);
    expect(isStale(now, "2026-11-11T12:00:00Z")).toBe(false);
    expect(isStale(now, null)).toBe(false);
  });
});

describe("messages", () => {
  it("describe the right pass", () => {
    expect(alertTitle("out", "Smith Wedding", 60)).toBe("Gear 60% checked out: Smith Wedding");
    expect(alertTitle("back", "Smith Wedding", 0)).toBe("Gear 0% checked back in: Smith Wedding");
    expect(alertBody("out", 60, 1)).toContain("1 item still not checked out");
    expect(alertBody("back", 20, 3)).toContain("3 items still not checked back in");
  });
  it("sms names the event and link, and shortens long names", () => {
    const sms = alertSms("back", "A".repeat(80), 40, "https://hub.example/x");
    expect(sms).toContain("back into the warehouse");
    expect(sms).toContain("https://hub.example/x");
    expect(sms).toContain("...");
  });
});
