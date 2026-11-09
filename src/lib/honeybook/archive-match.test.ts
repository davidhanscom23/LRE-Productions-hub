import { describe, expect, it } from "vitest";
import { guessKind, matchProject } from "./archive-match";
import { csvCell, toCsv } from "./csv";

const projects = [
  { id: "1", name: "Smith Wedding", clientName: "Jane Smith" },
  { id: "2", name: "Acme Holiday Party", clientName: "Bob Jones" },
  { id: "3", name: "Smith Corporate Gala", clientName: "Jane Smith" },
];

describe("archive matching", () => {
  it("matches by project and client words", () => {
    const m = matchProject("Acme-Holiday-Party-Signed-Contract.pdf", projects);
    expect(m?.projectId).toBe("2");
    expect(m?.confident).toBe(true);
  });
  it("is not confident when two projects tie", () => {
    const m = matchProject("Smith.pdf", projects);
    expect(m?.confident).toBe(false);
  });
  it("returns null with no overlap", () => {
    expect(matchProject("scan0001.pdf", projects)).toBeNull();
  });
  it("guesses kinds", () => {
    expect(guessKind("Signed Agreement.pdf")).toBe("contract");
    expect(guessKind("INV-0042.pdf")).toBe("invoice");
    expect(guessKind("Proposal v2.pdf")).toBe("proposal");
    expect(guessKind("misc.pdf")).toBe("other");
  });
});

describe("csv", () => {
  it("quotes, escapes and defuses formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell(null)).toBe("");
  });
  it("writes header and rows", () => {
    expect(toCsv([{ a: 1, b: "x y" }], [{ header: "A", value: (r) => r.a }, { header: "B", value: (r) => r.b }])).toBe("A,B\r\n1,x y\r\n");
  });
});
