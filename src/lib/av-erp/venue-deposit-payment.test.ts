import { describe, expect, it } from "vitest";
import {
  venueDepositApplyAmount,
  venueDepositPaymentReference,
} from "./venue-deposit-math";

describe("venueDepositPaymentReference", () => {
  it("is stable per request id", () => {
    expect(venueDepositPaymentReference("abc")).toBe("venue-deposit:abc");
  });
});

describe("venueDepositApplyAmount", () => {
  it("applies full deposit when under outstanding", () => {
    expect(
      venueDepositApplyAmount({
        depositAmount: 500,
        invoiceTotal: 2000,
        amountPaid: 0,
        amountCredited: 0,
      }),
    ).toBe(500);
  });

  it("caps at outstanding", () => {
    expect(
      venueDepositApplyAmount({
        depositAmount: 1500,
        invoiceTotal: 1000,
        amountPaid: 0,
        amountCredited: 200,
      }),
    ).toBe(800);
  });

  it("returns 0 when deposit missing or nothing due", () => {
    expect(
      venueDepositApplyAmount({
        depositAmount: 0,
        invoiceTotal: 1000,
        amountPaid: 0,
        amountCredited: 0,
      }),
    ).toBe(0);
    expect(
      venueDepositApplyAmount({
        depositAmount: 100,
        invoiceTotal: 1000,
        amountPaid: 1000,
        amountCredited: 0,
      }),
    ).toBe(0);
  });
});
