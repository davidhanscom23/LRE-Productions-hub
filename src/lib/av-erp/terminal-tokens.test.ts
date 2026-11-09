import { describe, expect, it } from "vitest";
import {
  hashIntegrationToken,
  mintApiTokenPlaintext,
  scopesInclude,
} from "./terminal-token-crypto";

describe("terminal tokens", () => {
  it("mints avk_live_ secrets with stable hashes", () => {
    const a = mintApiTokenPlaintext();
    expect(a.plaintext.startsWith("avk_live_")).toBe(true);
    expect(a.prefix).toBe(a.plaintext.slice(0, 16));
    expect(a.hash).toBe(hashIntegrationToken(a.plaintext));
    expect(hashIntegrationToken(a.plaintext + "x")).not.toBe(a.hash);
  });

  it("checks scopes", () => {
    expect(scopesInclude(["read"], "read")).toBe(true);
    expect(scopesInclude(["read"], "write")).toBe(false);
    expect(scopesInclude(["read", "write"], "write")).toBe(true);
  });
});
