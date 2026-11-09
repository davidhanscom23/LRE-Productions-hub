import { describe, expect, it } from "vitest";
import {
  crmLabelsMatch,
  normalizeCrmLabel,
} from "@/lib/event-packets/honeybook-link-match";

describe("normalizeCrmLabel", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeCrmLabel("  Smith-Jones Wedding! ")).toBe(
      "smith jones wedding",
    );
  });
});

describe("crmLabelsMatch", () => {
  it("matches identical client names", () => {
    expect(crmLabelsMatch("Alex Rivera", "Rivera Wedding", "Alex Rivera")).toBe(
      true,
    );
  });

  it("matches when project name contains client", () => {
    expect(
      crmLabelsMatch("Chen", "Chen & Patel Wedding", null),
    ).toBe(true);
  });

  it("rejects empty packet client", () => {
    expect(crmLabelsMatch("", "Anything", "Anything")).toBe(false);
  });

  it("rejects unrelated labels", () => {
    expect(
      crmLabelsMatch("Alex Rivera", "Corporate Gala Q3", "Acme Corp"),
    ).toBe(false);
  });
});
