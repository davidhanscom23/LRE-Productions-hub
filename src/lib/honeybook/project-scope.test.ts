import { describe, expect, it } from "vitest";
import {
  UNASSIGNED_FILTER,
  defaultScope,
  isUnassigned,
  isValidScope,
  matchesScope,
} from "./project-scope";

const mine = { assignees: [{ profile_id: "me" }] };
const hers = { assignees: [{ profile_id: "her" }, { profile_id: "me" }] };
const other = { assignees: [{ profile_id: "other" }] };
const nobody = { assignees: [] };
const missing = {};

describe("project scope", () => {
  it("defaults admins to everyone and staff to mine", () => {
    expect(defaultScope(true)).toBe("everyone");
    expect(defaultScope(false)).toBe("mine");
  });

  it("validates stored values", () => {
    expect(isValidScope("mine")).toBe(true);
    expect(isValidScope("everyone")).toBe(true);
    expect(isValidScope("all")).toBe(false);
    expect(isValidScope(null)).toBe(false);
  });

  it("mine keeps lead and support cards only", () => {
    const o = { scope: "mine" as const, profileId: "me", personFilter: "" };
    expect(matchesScope(mine, o)).toBe(true);
    expect(matchesScope(hers, o)).toBe(true);
    expect(matchesScope(other, o)).toBe(false);
    expect(matchesScope(nobody, o)).toBe(false);
    expect(matchesScope(missing, o)).toBe(false);
  });

  it("mine with no profile id shows nothing", () => {
    expect(
      matchesScope(mine, { scope: "mine", profileId: "", personFilter: "" }),
    ).toBe(false);
  });

  it("everyone shows all cards", () => {
    const o = { scope: "everyone" as const, profileId: "me", personFilter: "" };
    for (const p of [mine, other, nobody, missing]) {
      expect(matchesScope(p, o)).toBe(true);
    }
  });

  it("everyone with a person filter narrows to that person", () => {
    const o = { scope: "everyone" as const, profileId: "me", personFilter: "other" };
    expect(matchesScope(other, o)).toBe(true);
    expect(matchesScope(mine, o)).toBe(false);
    expect(matchesScope(hers, { ...o, personFilter: "her" })).toBe(true);
  });

  it("unassigned filter finds cards with no one on them", () => {
    const o = {
      scope: "everyone" as const,
      profileId: "me",
      personFilter: UNASSIGNED_FILTER,
    };
    expect(matchesScope(nobody, o)).toBe(true);
    expect(matchesScope(missing, o)).toBe(true);
    expect(matchesScope(mine, o)).toBe(false);
    expect(isUnassigned(other)).toBe(false);
  });

  it("person filter is ignored on mine", () => {
    expect(
      matchesScope(other, { scope: "mine", profileId: "me", personFilter: "other" }),
    ).toBe(false);
  });
});
