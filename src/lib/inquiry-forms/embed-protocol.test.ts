import { describe, expect, it } from "vitest";
import { EMBED_HEIGHT_MAX, EMBED_HEIGHT_MIN, clampEmbedHeight, isFormMessage, isHostMessage, parseAttribution, safeRedirectUrl } from "./embed-protocol";
import { EMBED_HOST_SOURCE, EMBED_MESSAGE_SOURCE } from "./types";

const base = { source: EMBED_MESSAGE_SOURCE, v: 1, slug: "check-your-date" } as const;

describe("isFormMessage", () => {
  it("accepts every well-formed message type", () => {
    expect(isFormMessage({ ...base, type: "ready" })).toBe(true);
    expect(isFormMessage({ ...base, type: "height", height: 812 })).toBe(true);
    expect(isFormMessage({ ...base, type: "height", height: 0 })).toBe(true);
    expect(isFormMessage({ ...base, type: "step", index: 0, total: 5 })).toBe(true);
    expect(isFormMessage({ ...base, type: "submitted", ending: "completed", formName: "Check Your Date" })).toBe(true);
    expect(isFormMessage({ ...base, type: "submitted", ending: "waitlisted", formName: "" })).toBe(true);
    expect(isFormMessage({ ...base, type: "redirect", url: "https://example.com/thanks" })).toBe(true);
  });

  it("rejects other senders, versions and slugs", () => {
    expect(isFormMessage({ ...base, source: "leadgate", type: "ready" })).toBe(false);
    expect(isFormMessage({ ...base, source: EMBED_HOST_SOURCE, type: "ready" })).toBe(false);
    expect(isFormMessage({ ...base, v: 2, type: "ready" })).toBe(false);
    expect(isFormMessage({ ...base, slug: "", type: "ready" })).toBe(false);
    expect(isFormMessage({ ...base, slug: "Bad Slug", type: "ready" })).toBe(false);
    expect(isFormMessage({ type: "leadgate-resize", formId: "x", height: 600 })).toBe(false);
  });

  it("rejects malformed fields", () => {
    for (const height of [Number.NaN, Number.POSITIVE_INFINITY, -1, "600"]) {
      expect(isFormMessage({ ...base, type: "height", height }), String(height)).toBe(false);
    }
    expect(isFormMessage({ ...base, type: "step", index: 5, total: 5 })).toBe(false);
    expect(isFormMessage({ ...base, type: "step", index: 1.5, total: 5 })).toBe(false);
    expect(isFormMessage({ ...base, type: "step", index: 0, total: 0 })).toBe(false);
    expect(isFormMessage({ ...base, type: "submitted", ending: "partial", formName: "x" })).toBe(false);
    expect(isFormMessage({ ...base, type: "submitted", ending: "completed" })).toBe(false);
    expect(isFormMessage({ ...base, type: "redirect" })).toBe(false);
    expect(isFormMessage({ ...base, type: "redirect", url: "" })).toBe(false);
    expect(isFormMessage({ ...base, type: "explode" })).toBe(false);
  });

  it("does not accept JSON strings, arrays or null", () => {
    expect(isFormMessage(JSON.stringify({ ...base, type: "ready" }))).toBe(false);
    expect(isFormMessage([base])).toBe(false);
    expect(isFormMessage(null)).toBe(false);
  });
});

describe("isHostMessage", () => {
  it("only accepts the redirect ack", () => {
    expect(isHostMessage({ source: EMBED_HOST_SOURCE, v: 1, type: "redirect-ack" })).toBe(true);
    expect(isHostMessage({ source: EMBED_MESSAGE_SOURCE, v: 1, type: "redirect-ack" })).toBe(false);
    expect(isHostMessage({ source: EMBED_HOST_SOURCE, v: 2, type: "redirect-ack" })).toBe(false);
    // LeadGate let any frame push fields into the form (bug B29); nothing like that exists here.
    expect(isHostMessage({ source: EMBED_HOST_SOURCE, v: 1, type: "set-fields", fields: { score: 100 } })).toBe(false);
    expect(isHostMessage({ type: "leadgate-set-fields", fields: {} })).toBe(false);
    expect(isHostMessage("redirect-ack")).toBe(false);
  });
});

describe("safeRedirectUrl (LeadGate let any frame send the host anywhere, bug B1)", () => {
  it("keeps absolute http(s) URLs, normalized", () => {
    expect(safeRedirectUrl("https://example.com/thank-you")).toBe("https://example.com/thank-you");
    expect(safeRedirectUrl("  http://example.com  ")).toBe("http://example.com/");
    expect(safeRedirectUrl("HTTPS://Example.COM/Path?x=1#top")).toBe("https://example.com/Path?x=1#top");
    expect(safeRedirectUrl("https://example.com/a b")).toBe("https://example.com/a%20b");
  });

  it("rejects script, data, relative and credential URLs", () => {
    for (const bad of [
      "javascript:alert(1)",
      " JAVASCRIPT:alert(1)",
      "\u0001javascript:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "blob:https://example.com/123",
      "vbscript:msgbox(1)",
      "//evil.example/path",
      "/thanks",
      "thanks.html",
      "ftp://example.com",
      "https://",
      "https://user:pass@example.com",
      "https://example.com@evil.example",
      `https://example.com/${"a".repeat(2050)}`,
      "",
    ]) {
      expect(safeRedirectUrl(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(safeRedirectUrl(null)).toBeNull();
    expect(safeRedirectUrl({ href: "https://example.com" })).toBeNull();
  });
});

describe("parseAttribution", () => {
  it("reads UTM tags and click ids from the query string", () => {
    const a = parseAttribution(
      "?utm_source=google&utm_medium=cpc&utm_campaign=weddings&utm_term=dj&utm_content=ad1&gclid=Cj0K&fbclid=IwAR&msclkid=m1&gbraid=g1&wbraid=w1",
      "",
      "",
      "",
    );
    expect(a).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "weddings",
      utm_term: "dj",
      utm_content: "ad1",
      gclid: "Cj0K",
      gbraid: "g1",
      wbraid: "w1",
      fbclid: "IwAR",
      msclkid: "m1",
    });
  });

  it("reads the hash too, and the query wins", () => {
    expect(parseAttribution("", "#utm_source=facebook&gclid=abc", "", "")).toEqual({ utm_source: "facebook", gclid: "abc" });
    expect(parseAttribution("", "#/contact?utm_campaign=spring", "", "")).toEqual({ utm_campaign: "spring" });
    expect(parseAttribution("?utm_source=google", "#utm_source=facebook&utm_medium=social", "", "")).toEqual({
      utm_source: "google",
      utm_medium: "social",
    });
    expect(parseAttribution("", "#section-2", "", "")).toEqual({});
  });

  it("is case-insensitive on names, skips blanks, cleans and caps values", () => {
    const a = parseAttribution(`?UTM_Source=News%0Aletter&utm_medium=&gclid=${"x".repeat(600)}`, "", "", "");
    expect(a.utm_source).toBe("Newsletter");
    expect(a.utm_medium).toBeUndefined();
    expect(a.gclid).toHaveLength(500);
  });

  it("keeps the page URL with its query but drops its fragment", () => {
    const a = parseAttribution("", "", "", "https://example.com/weddings/?utm_source=google#access_token=secret");
    expect(a.page_url).toBe("https://example.com/weddings/?utm_source=google");
    expect(a.host_domain).toBe("example.com");
  });

  it("keeps an http(s) referrer only", () => {
    expect(parseAttribution("", "", "https://www.google.com/", "").referrer).toBe("https://www.google.com/");
    expect(parseAttribution("", "", "android-app://com.google.android.gm/", "").referrer).toBeUndefined();
    expect(parseAttribution("", "", "", "file:///C:/test.html").page_url).toBeUndefined();
  });

  it("accepts a full URL passed as the search and never throws on junk", () => {
    expect(parseAttribution("https://example.com/p?gclid=1#x", "", "", "").gclid).toBe("1");
    expect(parseAttribution("%%%", "#%%", "not a url", "::::")).toEqual({});
    expect(parseAttribution(undefined as unknown as string, null as unknown as string, 5 as unknown as string, {} as unknown as string)).toEqual({});
  });
});

describe("clampEmbedHeight", () => {
  it("clamps to 200..6000 and rounds up", () => {
    expect(clampEmbedHeight(50)).toBe(EMBED_HEIGHT_MIN);
    expect(clampEmbedHeight(9000)).toBe(EMBED_HEIGHT_MAX);
    expect(clampEmbedHeight(512.3)).toBe(513);
    expect(clampEmbedHeight(Number.NaN)).toBe(EMBED_HEIGHT_MIN);
  });
});
