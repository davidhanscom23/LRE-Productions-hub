import { describe, expect, it } from "vitest";
import { INQUIRE_EMBED_SCRIPT_PATH, isInquiryPublicPage, isSessionlessInquiryRequest } from "./inquiry-paths";

describe("isInquiryPublicPage", () => {
  it("opens the public form pages and the embed loader signed out", () => {
    expect(isInquiryPublicPage("/inquire/get-a-quote")).toBe(true);
    expect(isInquiryPublicPage("/inquire/request-av")).toBe(true);
    expect(isInquiryPublicPage(INQUIRE_EMBED_SCRIPT_PATH)).toBe(true);
  });

  it("keeps the admin builder and everything else behind login", () => {
    expect(isInquiryPublicPage("/inquiry-forms")).toBe(false);
    expect(isInquiryPublicPage("/inquiry-forms/settings")).toBe(false);
    expect(isInquiryPublicPage("/inquiry-forms/123")).toBe(false);
    expect(isInquiryPublicPage("/inquire")).toBe(false);
    expect(isInquiryPublicPage("/pipeline")).toBe(false);
    expect(isInquiryPublicPage("/api/inquire/start")).toBe(false);
  });
});

describe("isSessionlessInquiryRequest", () => {
  it("passes the public form API through for POST, sendBeacon and preflight", () => {
    for (const p of [
      "/api/inquire/start",
      "/api/inquire/11111111-1111-4111-8111-111111111111/save",
      "/api/inquire/11111111-1111-4111-8111-111111111111/ping",
      "/api/inquire/11111111-1111-4111-8111-111111111111/qualify",
      "/api/inquire/11111111-1111-4111-8111-111111111111/complete",
      "/api/inquire/view",
    ]) {
      expect(isSessionlessInquiryRequest(p, "POST"), p).toBe(true);
      expect(isSessionlessInquiryRequest(p, "OPTIONS"), p).toBe(true);
      expect(isSessionlessInquiryRequest(p, "GET"), p).toBe(false);
    }
  });

  it("serves the embed script without a session", () => {
    expect(isSessionlessInquiryRequest("/inquire/embed.js", "GET")).toBe(true);
    expect(isSessionlessInquiryRequest("/inquire/embed.js", "HEAD")).toBe(true);
    expect(isSessionlessInquiryRequest("/inquire/embed.js", "POST")).toBe(false);
  });

  it("keeps the admin draft preview API, the form pages and the builder on normal auth", () => {
    expect(isSessionlessInquiryRequest("/api/inquire/preview/qualify", "POST")).toBe(false);
    expect(isSessionlessInquiryRequest("/inquire/get-a-quote", "GET")).toBe(false);
    expect(isSessionlessInquiryRequest("/inquiry-forms", "GET")).toBe(false);
    expect(isSessionlessInquiryRequest("/api/inquiry-forms/x", "POST")).toBe(false);
  });
});
