import { describe, expect, it } from "vitest";

import {
  buildDuplicateMap,
  findSimilarProjects,
  normalizeProjectName,
  scoreDuplicate,
  type DupCandidate,
} from "./duplicates";

const gala = (over: Partial<DupCandidate>): DupCandidate => ({
  id: "a",
  name: "KW St. Johns Awards Gala",
  client_id: "c1",
  client_name: "ShannonGriggs",
  stage: "Retainer Paid",
  ...over,
});

describe("normalizeProjectName", () => {
  it("drops punctuation and dashes", () => {
    expect(normalizeProjectName("Event – KW St. John's Gala")).toBe(
      "event kw st johns gala",
    );
  });
});

describe("scoreDuplicate", () => {
  it("flags same client + same name with one card undated", () => {
    const a = gala({ id: "a", project_date: null });
    const b = gala({ id: "b", project_date: "2027-03-04" });
    expect(scoreDuplicate(a, b).score).toBeGreaterThanOrEqual(5);
  });

  it("does not flag a recurring event on two different dates", () => {
    const a = gala({ id: "a", project_date: "2026-03-04" });
    const b = gala({ id: "b", project_date: "2027-03-04" });
    expect(scoreDuplicate(a, b).score).toBeLessThan(5);
  });

  it("does not flag same name for unrelated clients with no dates", () => {
    const a = gala({ id: "a", client_id: "c1" });
    const b = gala({ id: "b", client_id: "c2" });
    expect(scoreDuplicate(a, b).score).toBeLessThan(5);
  });

  it("flags same name + same date even for different client records", () => {
    const a = gala({ id: "a", client_id: "c1", project_date: "2026-11-13" });
    const b = gala({ id: "b", client_id: "c2", project_date: "2026-11-13" });
    expect(scoreDuplicate(a, b).score).toBeGreaterThanOrEqual(5);
  });

  it("matches the same client email across client records", () => {
    const a = gala({ id: "a", client_id: "c1", client_email: "S@x.com" });
    const b = gala({ id: "b", client_id: "c2", client_email: "s@x.com" });
    expect(scoreDuplicate(a, b).reasons).toContain("same client");
  });
});

describe("findSimilarProjects / buildDuplicateMap", () => {
  const a = gala({ id: "a" });
  const b = gala({ id: "b", project_date: "2027-03-04" });
  const other = { id: "z", name: "Smith Wedding", client_id: "c9", stage: "Booked" };

  it("lists twins and ignores unrelated cards", () => {
    const hits = findSimilarProjects(a, [a, b, other]);
    expect(hits.map((h) => h.id)).toEqual(["b"]);
  });

  it("ignores merged and archived cards", () => {
    const merged = { ...b, merged_into: "a" };
    const archived = { ...b, id: "c", stage: "Archived" };
    expect(findSimilarProjects(a, [a, merged, archived])).toEqual([]);
  });

  it("builds a two-way map", () => {
    const map = buildDuplicateMap([a, b, other]);
    expect(map.get("a")?.[0].id).toBe("b");
    expect(map.get("b")?.[0].id).toBe("a");
    expect(map.has("z")).toBe(false);
  });
});
