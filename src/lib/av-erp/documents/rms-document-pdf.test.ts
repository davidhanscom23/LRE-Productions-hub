import { describe, expect, it } from "vitest";
import { buildCustomerEstimate } from "@/lib/av-erp/estimate-view";
import { rmsDocumentFromEstimate } from "@/lib/av-erp/documents/from-estimate";
import { rmsDocumentFromInvoice, rmsReceiptFromInvoice } from "@/lib/av-erp/documents/from-invoice";
import {
  buildRmsDocumentPdf,
  rmsDocumentFileName,
} from "@/lib/av-erp/documents/rms-document-pdf";
import type { AvInvoice, AvInvoiceLine } from "@/lib/av-erp/types";

describe("buildRmsDocumentPdf", () => {
  it("builds estimate, contract, and invoice PDFs with RMS chrome", async () => {
    const estimate = buildCustomerEstimate({
      reference: "Q-0042",
      subject: "Ballroom AV",
      customer: {
        name: "Acme Corp",
        contactName: "Pat",
        email: "pat@acme.test",
        phone: "555-0100",
        addressLines: ["1 Main St", "Ponte Vedra, FL 32081"],
      },
      venue: {
        name: "Grand Hall",
        contactName: "",
        email: "",
        phone: "",
        addressLines: ["9 Venue Rd"],
      },
      gearStartsAt: "2026-11-10T14:00:00.000Z",
      gearEndsAt: "2026-11-11T02:00:00.000Z",
      groups: [{ id: "g", name: "Main Portal", sort_order: 0 }],
      lines: [
        {
          id: "l1",
          group_id: "g",
          description: "Speaker",
          qty: 2,
          unit_price: 100,
          discount_pct: 0,
          sort_order: 0,
          product_id: "p1",
        },
        {
          id: "l2",
          group_id: "g",
          description: "Tech labor",
          qty: 1,
          unit_price: 500,
          discount_pct: 0,
          sort_order: 1,
          service_id: "s1",
        },
      ],
      discountPct: 10,
    });

    const quoteDoc = rmsDocumentFromEstimate(estimate, "estimate");
    expect(quoteDoc.sections[0].lines[0].typeLabel).toBe("Rental");
    expect(quoteDoc.sections[0].lines[1].typeLabel).toBe("Service");
    expect(quoteDoc.showSignature).toBe(true);

    const quotePdf = await buildRmsDocumentPdf(quoteDoc);
    expect(String.fromCharCode(...quotePdf.slice(0, 4))).toBe("%PDF");
    expect(quotePdf.byteLength).toBeGreaterThan(800);
    expect(rmsDocumentFileName(quoteDoc)).toContain("Estimate-Q-0042");

    const contractPdf = await buildRmsDocumentPdf(
      rmsDocumentFromEstimate(estimate, "contract"),
    );
    expect(String.fromCharCode(...contractPdf.slice(0, 4))).toBe("%PDF");

    const invoice: AvInvoice = {
      id: "inv",
      reference: "INV-9",
      opportunity_id: null,
      customer_id: null,
      subject: "Ballroom AV",
      status: "sent",
      issued_at: "2026-11-01T12:00:00.000Z",
      due_at: "2026-11-15T12:00:00.000Z",
      subtotal: 700,
      total: 700,
      amount_paid: 100,
      amount_credited: 0,
      notes: "",
      created_at: "",
      updated_at: "",
    };
    const lines: AvInvoiceLine[] = [
      {
        id: "il",
        invoice_id: "inv",
        description: "Package",
        qty: 1,
        unit_price: 700,
        sort_order: 0,
      },
    ];
    const invDoc = rmsDocumentFromInvoice({ invoice, lines });
    expect(invDoc.kind).toBe("invoice");
    expect(invDoc.showSignature).toBe(false);
    const invPdf = await buildRmsDocumentPdf(invDoc);
    expect(String.fromCharCode(...invPdf.slice(0, 4))).toBe("%PDF");
    expect(rmsDocumentFileName(invDoc)).toContain("Invoice-INV-9");
  });
});

describe("billing types and receipts", () => {
  const base = {
    reference: "Q-1",
    subject: "Gala",
    groups: [{ id: "g", name: "Audio", sort_order: 0 }],
    lines: [
      { id: "a", group_id: "g", description: "Speaker", qty: 2, unit_price: 100, discount_pct: 0, sort_order: 0, product_id: "p" },
    ],
    surchargePct: 23,
  };

  it("direct estimates show the surcharge, venue estimates drop it", () => {
    const direct = buildCustomerEstimate({ ...base, billingType: "direct" });
    const venue = buildCustomerEstimate({ ...base, billingType: "venue" });
    expect(direct.surchargeAmount).toBe(46);
    expect(venue.surchargeAmount).toBe(0);
    expect(venue.total).toBe(200);
    expect(rmsDocumentFromEstimate(venue, "estimate").billingType).toBe("venue");
  });

  it("pulls the Surcharge line out of an invoice and builds a receipt", async () => {
    const invoice: AvInvoice = {
      id: "i", reference: "INV-3", opportunity_id: null, customer_id: null, subject: "Gala", status: "partial",
      issued_at: "2026-11-01", due_at: "2026-11-15", subtotal: 246, total: 246, amount_paid: 100, amount_credited: 0,
      notes: "", created_at: "", updated_at: "",
    };
    const lines: AvInvoiceLine[] = [
      { id: "1", invoice_id: "i", description: "Speaker", qty: 2, unit_price: 100, sort_order: 0 },
      { id: "2", invoice_id: "i", description: "Surcharge (23%)", qty: 1, unit_price: 46, sort_order: 1 },
    ];
    const doc = rmsDocumentFromInvoice({ invoice, lines });
    expect(doc.surchargeAmount).toBe(46);
    expect(doc.sections[0].lines).toHaveLength(1);
    expect(doc.linesSubtotal).toBe(200);

    const receipt = rmsReceiptFromInvoice({
      invoice, lines, billingType: "venue",
      payments: [{ id: "p", invoice_id: "i", amount: 100, received_at: "2026-11-05", method: "Card", reference: "ch_1", notes: "", created_at: "" }],
    });
    expect(receipt.kind).toBe("receipt");
    expect(receipt.amountPaid).toBe(100);
    const pdf = await buildRmsDocumentPdf(receipt);
    expect(String.fromCharCode(...pdf.slice(0, 4))).toBe("%PDF");
    expect(rmsDocumentFileName(receipt)).toContain("Receipt-INV-3");
    const venueInvoice = await buildRmsDocumentPdf({ ...doc, billingType: "venue" });
    expect(venueInvoice.byteLength).toBeGreaterThan(800);
  });
});
