import { describe, expect, it } from "vitest";
import { scopesInclude } from "./terminal-token-crypto";

describe("Terminal write scope gate", () => {
  it("requires write scope for mutating calls", () => {
    expect(scopesInclude(["read"], "write")).toBe(false);
    expect(scopesInclude(["read", "write"], "write")).toBe(true);
    expect(scopesInclude(["write"], "write")).toBe(true);
  });

  it("still allows read with read-only keys", () => {
    expect(scopesInclude(["read"], "read")).toBe(true);
    expect(scopesInclude(["read", "write"], "read")).toBe(true);
  });
});
