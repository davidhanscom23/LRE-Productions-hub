import { describe, expect, it } from "vitest";
import {
  archiveCutoff,
  archiveFileName,
  buildCsv,
  liveWindowCutoff,
  photoFileName,
  type ArchiveCheckRow,
} from "./format";

const row = (over: Partial<ArchiveCheckRow> = {}): ArchiveCheckRow => ({
  id: "abc",
  checked_at: "2026-03-04T15:00:00.000Z",
  project_name: "Smith Wedding",
  event_date: "2026-03-05",
  item_name: 'Speaker, 12"',
  pass: "out",
  qty: 2,
  flag: "none",
  note: "",
  checked_by_name: "Sam",
  photo_path: null,
  ...over,
});

describe("liveWindowCutoff", () => {
  it("is 90 days back", () => {
    expect(liveWindowCutoff(new Date("2026-11-09T00:00:00Z")).toISOString()).toBe("2026-08-11T00:00:00.000Z");
  });
});

describe("archiveCutoff", () => {
  it("runs on Dec 31 for everything so far", () => {
    const now = new Date("2026-12-31T09:00:00Z");
    expect(archiveCutoff(now)?.toISOString()).toBe(now.toISOString());
  });
  it("catches up in the first week of January for the old year only", () => {
    expect(archiveCutoff(new Date("2027-01-03T09:00:00Z"))?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("does nothing the rest of the year unless forced", () => {
    expect(archiveCutoff(new Date("2026-11-09T09:00:00Z"))).toBeNull();
    expect(archiveCutoff(new Date("2027-01-08T09:00:00Z"))).toBeNull();
    expect(archiveCutoff(new Date("2026-11-09T09:00:00Z"), true)).not.toBeNull();
  });
});

describe("names", () => {
  it("builds unique-ish zip and photo names", () => {
    expect(archiveFileName(new Date("2026-12-31T09:05:00Z"), 2)).toBe("checklist-history-2026-20261231-0905-part2.zip");
    expect(photoFileName(row())).toBe("photos/2026-03-04-abc.jpg");
  });
});

describe("buildCsv", () => {
  it("quotes cells and neutralises spreadsheet formulas", () => {
    const csv = buildCsv(
      [row(), row({ id: "z", note: "=HYPERLINK(1)", flag: "damaged", pass: "back", photo_path: "p" })],
      new Map([["z", "photos/x.jpg"]]),
    );
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Speaker, 12"""');
    expect(lines[1]).toContain("Out of warehouse");
    expect(lines[2]).toContain("'=HYPERLINK(1)");
    expect(lines[2]).toContain("damaged");
    expect(lines[2].endsWith("photos/x.jpg")).toBe(true);
  });
});
