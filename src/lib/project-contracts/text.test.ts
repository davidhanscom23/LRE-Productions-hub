import { describe, expect, it } from "vitest";
import { fillContract, leftoverTokens, toWinAnsi, wrapText } from "./text";
import { buildContractPdf } from "./pdf";

const ctx = { clientName: "Pat Lee", clientEmail: "", projectName: "Lee Wedding", eventDate: "June 5, 2027", location: "", companyName: "LRE Productions", today: "November 7, 2026" };

describe("contract text", () => {
  it("fills tokens, marks gaps, leaves unknown tokens", () => {
    const out = fillContract("{{client_name}} at {{ location }} on {{event_date}} {{mystery}}", ctx);
    expect(out).toBe("Pat Lee at to be confirmed on June 5, 2027 {{mystery}}");
    expect(leftoverTokens(out)).toEqual(["{{mystery}}"]);
  });

  it("makes text PDF safe", () => {
    expect(toWinAnsi("It’s “great” — ok \u{1F600}")).toBe("It's \"great\" - ok ");
  });

  it("wraps without losing words", () => {
    const text = "one two three four five six seven eight nine ten\n\nnext paragraph";
    const lines = wrapText(text, 40, (s) => s.length * 5);
    expect(lines.join(" ").replace(/\s+/g, " ").trim()).toBe(text.replace(/\n+/g, " ").replace(/\s+/g, " "));
    expect(lines.every((l) => l.length * 5 <= 40 || !l.includes(" "))).toBe(true);
    expect(lines).toContain("");
  });

  it("builds a multi-page signed pdf", async () => {
    const body = Array.from({ length: 120 }, (_, i) => `${i + 1}. Clause number ${i + 1} that goes on for a little while so it wraps nicely.`).join("\n");
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const bytes = await buildContractPdf({
      companyName: "LRE Productions",
      title: "Agreement",
      body,
      projectName: "Lee Wedding",
      signature: { signerName: "Pat Lee", signerEmail: "pat@example.com", signedAtLabel: "Nov 7, 2026", ip: "1.2.3.4", documentHash: "abc", png },
    });
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  });
});

import { parseContractBlocks } from "./blocks";
import { AV_BODY, COMBINED_BODY, DMC_BODY, STANDARD_CONTRACT_TEMPLATES } from "./standard-templates";

describe("contract blocks", () => {
  it("reads headings, details, bullets and clauses", () => {
    const b = parseContractBlocks("## FEES\nFees | $100\nTerms | Net 30\n\n- one\n- two\n\n(a) Clause text\n\nPlain text.");
    expect(b.map((x) => x.kind)).toEqual(["heading", "details", "bullets", "clause", "paragraph"]);
    expect(b[1]).toEqual({ kind: "details", rows: [{ label: "Fees", value: "$100" }, { label: "Terms", value: "Net 30" }] });
  });

  it("still treats old numbered ALL-CAPS lines as headings", () => {
    expect(parseContractBlocks("1. EVENT\nDate: soon")[0]).toEqual({ kind: "heading", text: "1. EVENT" });
  });
});

describe("standard contract templates", () => {
  const full = { ...ctx, clientPhone: "1", clientAddress: "a", feeTotal: "$1.00", servicesList: "- x", paymentSchedule: "p" };
  it("has three templates and every token is one we fill", () => {
    expect(STANDARD_CONTRACT_TEMPLATES).toHaveLength(3);
    for (const body of [DMC_BODY, AV_BODY, COMBINED_BODY]) expect(leftoverTokens(fillContract(body, full))).toEqual([]);
  });
  it("covers every AV clause (20 sections) and DMC clause (11 sections)", () => {
    expect((AV_BODY.match(/^## \d+\. /gm) ?? []).length).toBe(20);
    expect((DMC_BODY.match(/^## \d+\. /gm) ?? []).length).toBe(11);
    expect(COMBINED_BODY).toContain("PART A");
    expect(COMBINED_BODY).toContain("## B12. ASSIGNMENT AND DELEGATION");
  });
});
