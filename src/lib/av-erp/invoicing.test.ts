import { describe, expect, it } from "vitest";
import {
  deriveInvoiceStatus,
  invoiceGrandTotal,
  invoiceLineTotal,
  invoiceLinesSubtotal,
  invoiceOutstanding,
  invoiceTaxAmount,
  resolveInvoiceTaxRatePct,
} from "./invoicing";

describe("av-erp invoicing", () => {
  it("totals lines and outstanding", () => {
    expect(invoiceLineTotal(2, 150.5)).toBe(301);
    expect(invoiceLineTotal(1, -50)).toBe(-50);
    expect(invoiceOutstanding(1000, 250)).toBe(750);
    expect(invoiceOutstanding(100, 150)).toBe(0);
  });

  it("recomputes draft subtotal from lines including discounts", () => {
    expect(
      invoiceLinesSubtotal([
        { qty: 2, unit_price: 100 },
        { qty: 1, unit_price: 50.5 },
        { qty: 1, unit_price: -25 },
      ]),
    ).toBe(225.5);
    expect(invoiceLinesSubtotal([])).toBe(0);
  });

  it("subtracts credits from outstanding", () => {
    expect(invoiceOutstanding(1000, 200, 100)).toBe(700);
    expect(invoiceOutstanding(100, 40, 60)).toBe(0);
    expect(invoiceOutstanding(50, 0, 80)).toBe(0);
  });

  it("derives status from payments", () => {
    expect(
      deriveInvoiceStatus({ current: "draft", total: 100, amountPaid: 0 }),
    ).toBe("draft");
    expect(
      deriveInvoiceStatus({
        current: "draft",
        total: 100,
        amountPaid: 0,
        markSent: true,
      }),
    ).toBe("sent");
    expect(
      deriveInvoiceStatus({ current: "sent", total: 100, amountPaid: 40 }),
    ).toBe("partial");
    expect(
      deriveInvoiceStatus({ current: "sent", total: 100, amountPaid: 100 }),
    ).toBe("paid");
    expect(
      deriveInvoiceStatus({ current: "void", total: 100, amountPaid: 50 }),
    ).toBe("void");
  });

  it("computes sales tax and resolves rate", () => {
    expect(invoiceTaxAmount(1000, 6.5)).toBe(65);
    expect(invoiceGrandTotal(1000, 65)).toBe(1065);
    expect(
      resolveInvoiceTaxRatePct({
        customerTaxExempt: true,
        shopDefaultRatePct: 7,
      }),
    ).toBe(0);
    expect(
      resolveInvoiceTaxRatePct({
        overrideRatePct: 8.25,
        customerTaxExempt: true,
        shopDefaultRatePct: 7,
      }),
    ).toBe(8.25);
    expect(
      resolveInvoiceTaxRatePct({ shopDefaultRatePct: 7 }),
    ).toBe(7);
  });

  it("derives status from credits alone or with payments", () => {
    expect(
      deriveInvoiceStatus({
        current: "sent",
        total: 100,
        amountPaid: 0,
        amountCredited: 40,
      }),
    ).toBe("partial");
    expect(
      deriveInvoiceStatus({
        current: "sent",
        total: 100,
        amountPaid: 0,
        amountCredited: 100,
      }),
    ).toBe("paid");
    expect(
      deriveInvoiceStatus({
        current: "sent",
        total: 100,
        amountPaid: 25,
        amountCredited: 75,
      }),
    ).toBe("paid");
  });
});
