import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseCsv } from "./csv";
import { normalizeDjepEventId } from "@/lib/types/event-reviews";
import { splitAssignedStaff } from "@/lib/event-packets/match-staff";

describe("parseCsv (reviews published sheet)", () => {
  it("parses quoted comments and Event_ID column", () => {
    const csv = [
      "Name,Comment,Rating,Date,Event Type,Service(s),Staff Member(s),Show on site?,Needs review?,Event_ID",
      'Jane,"Hello, world",5,2026-01-01,Wedding,DJ,David; Hector,yes,,146358',
      "Bob,Great night,5,2026-02-01,Corporate,DJ,Golden,yes,,",
    ].join("\n");

    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.[9]).toBe("Event_ID");
    expect(rows[1]?.[1]).toBe("Hello, world");
    expect(rows[1]?.[6]).toBe("David; Hector");
    expect(normalizeDjepEventId(rows[1]?.[9])).toBe("146358");
    expect(normalizeDjepEventId(rows[2]?.[9])).toBeNull();
  });

  it("reads the live website published CSV fixture when present", () => {
    let text = "";
    try {
      text = readFileSync("/tmp/reviews.csv", "utf8");
    } catch {
      return; // fixture only available in smoke-test environments
    }
    const rows = parseCsv(text);
    expect(rows.length).toBeGreaterThan(100);
    const headers = rows[0] ?? [];
    const eventIdx = headers.findIndex((h) => h.trim() === "Event_ID");
    expect(eventIdx).toBeGreaterThanOrEqual(0);
    let withId = 0;
    for (const row of rows.slice(1)) {
      if (normalizeDjepEventId(row[eventIdx] ?? "")) withId += 1;
    }
    expect(withId).toBeGreaterThan(300);
  });
});

describe("splitAssignedStaff", () => {
  it("splits website sheet semicolons", () => {
    expect(splitAssignedStaff("David; Hector")).toEqual(["David", "Hector"]);
    expect(splitAssignedStaff("Golden; Wanda")).toEqual(["Golden", "Wanda"]);
  });
});
