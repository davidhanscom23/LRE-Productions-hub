import { describe, expect, it } from "vitest";
import { buildRmsDocumentPdf } from "@/lib/av-erp/documents/rms-document-pdf";
import { rmsDocumentFromProjectInvoice, type ProjectInvoiceDocInput } from "./document";

const input: ProjectInvoiceDocInput = {
  number: "PI-0007",
  title: "Wedding weekend",
  issuedAt: "2026-11-01",
  dueAt: "2026-12-01",
  taxRatePct: 0,
  subtotal: 1200,
  taxAmount: 0,
  total: 1200,
  amountPaid: 600,
  notes: "",
  projectName: "Smith Wedding",
  clientName: "Pat Smith",
  clientEmail: "pat@example.test",
  lines: [
    { description: "Day-of coordination", qty: 1, unit_price: 800, section: "Planning" },
    { description: "Shuttle", qty: 2, unit_price: 200, section: "Transportation" },
  ],
  installments: [
    { label: "Retainer", amount: 600, due_at: "2026-11-01" },
    { label: "Balance", amount: 600, due_at: "2026-12-01" },
  ],
  payUrl: "https://example.test/pay/abc",
  payments: [{ received_at: "2026-11-02", method: "check", reference: "1042", amount: 600 }],
};

describe("rmsDocumentFromProjectInvoice", () => {
  it("builds sections with totals and a valid PDF for invoice and receipt", async () => {
    const inv = rmsDocumentFromProjectInvoice(input, "invoice");
    expect(inv.sections.map((s) => s.name)).toEqual(["Planning", "Transportation"]);
    expect(inv.paymentDetails).toContain("Pay online");
    const rec = rmsDocumentFromProjectInvoice(input, "receipt");
    expect(rec.amountPaid).toBe(600);
    for (const d of [inv, rec]) {
      const bytes = await buildRmsDocumentPdf(d);
      expect(Buffer.from(bytes.slice(0, 4)).toString()).toBe("%PDF");
    }
  });
});
