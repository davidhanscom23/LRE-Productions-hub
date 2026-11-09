import { describe, expect, it } from "vitest";
import {
  deriveSecret,
  hashToken,
  hexDigestsEqual,
  hmacHex,
  isPlausibleToken,
  newToken,
  sha256Hex,
  tokenMatches,
} from "./tokens-core";

describe("submission tokens", () => {
  it("issues long, unique, url-safe tokens", () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isPlausibleToken(a)).toBe(true);
  });

  it("stores only the sha256 hex of the token", () => {
    expect(hashToken("abc")).toBe(sha256Hex("abc"));
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("accepts the right token and rejects tampering", () => {
    const token = newToken();
    const stored = hashToken(token);
    expect(tokenMatches(token, stored)).toBe(true);
    expect(tokenMatches(token, stored.toUpperCase())).toBe(true);
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(tokenMatches(tampered, stored)).toBe(false);
    expect(tokenMatches(undefined, stored)).toBe(false);
    expect(tokenMatches("", stored)).toBe(false);
    expect(tokenMatches(token, null)).toBe(false);
    expect(tokenMatches(token, "")).toBe(false);
    expect(tokenMatches(stored, stored)).toBe(false);
  });

  it("compares digests in constant time and never throws on bad input", () => {
    expect(hexDigestsEqual("ab", "ab")).toBe(true);
    expect(hexDigestsEqual("ab", "abcd")).toBe(false);
    expect(hexDigestsEqual("zz", "zz")).toBe(false);
    expect(hexDigestsEqual("", "")).toBe(false);
  });

  it("rejects implausible tokens before hashing", () => {
    expect(isPlausibleToken("short")).toBe(false);
    expect(isPlausibleToken("a".repeat(129))).toBe(false);
    expect(isPlausibleToken("has spaces in it but long enough")).toBe(false);
    expect(isPlausibleToken(12345)).toBe(false);
  });
});

describe("module secret", () => {
  it("prefers INQUIRY_FORMS_SECRET", () => {
    expect(deriveSecret({ INQUIRY_FORMS_SECRET: " own ", SUPABASE_SERVICE_ROLE_KEY: "svc" })).toBe("own");
  });

  it("falls back to HMAC(service role key, 'inquiry-forms:v1')", () => {
    expect(deriveSecret({ SUPABASE_SERVICE_ROLE_KEY: "svc" })).toBe(hmacHex("svc", "inquiry-forms:v1"));
  });

  it("returns null when neither exists", () => {
    expect(deriveSecret({})).toBeNull();
    expect(deriveSecret({ INQUIRY_FORMS_SECRET: "  ", SUPABASE_SERVICE_ROLE_KEY: "" })).toBeNull();
  });

  it("keys hashes by secret", () => {
    expect(hmacHex("s1", "1.2.3.4")).not.toBe(hmacHex("s2", "1.2.3.4"));
    expect(hmacHex("s1", "1.2.3.4")).toMatch(/^[0-9a-f]{64}$/);
  });
});
