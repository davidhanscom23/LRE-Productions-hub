import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, signState, verifyState } from "./crypto";
import { buildQbInvoice, buildQbPayment, customerDisplayName, qbEscape } from "./mapping";

describe("quickbooks crypto", () => {
  it("round-trips tokens and rejects the wrong secret", () => {
    const blob = encryptToken("refresh-abc", "s3cret");
    expect(blob).not.toContain("refresh-abc");
    expect(decryptToken(blob, "s3cret")).toBe("refresh-abc");
    expect(() => decryptToken(blob, "other")).toThrow();
  });
  it("verifies state for the same admin, once fresh", () => {
    const s = signState("user-1", "k", 1_000);
    expect(verifyState(s, "user-1", "k", 2_000)).toBe(true);
    expect(verifyState(s, "user-2", "k", 2_000)).toBe(false);
    expect(verifyState(s, "user-1", "wrong", 2_000)).toBe(false);
    expect(verifyState(s, "user-1", "k", 1_000 + 16 * 60_000)).toBe(false);
    expect(verifyState("junk", "user-1", "k")).toBe(false);
  });
});

describe("quickbooks mapping", () => {
  it("escapes query values and cleans names", () => {
    expect(qbEscape("O'Brien\\x")).toBe("O\\'Brien\\\\x");
    expect(customerDisplayName("Acme: West", "P")).toBe("Acme - West");
    expect(customerDisplayName(null, "Lee Wedding")).toBe("Lee Wedding");
  });
  it("builds an invoice whose lines add up to the Hub total", () => {
    const body = buildQbInvoice(
      { number: "PI-0007", title: "", issuedAt: "2026-11-01", dueAt: null, taxAmount: 7, notes: "", lines: [{ description: "DJ", qty: 2, unit_price: 50 }, { description: "Lights", qty: 1, unit_price: 0.5 }] },
      { customerId: "C1", itemId: "I1" },
    );
    const sum = (body.Line as { Amount: number }[]).reduce((s, l) => s + l.Amount, 0);
    expect(Math.round(sum * 100)).toBe(10750);
    expect(body.DocNumber).toBe("PI-0007");
    expect(body.CustomerMemo).toBeUndefined();
  });
  it("links a payment to its invoice", () => {
    const p = buildQbPayment({ amount: 100.005, receivedAt: "2026-11-02", reference: null, method: "check" }, { customerId: "C1", qbInvoiceId: "55" });
    expect(p.Line[0].LinkedTxn[0]).toEqual({ TxnId: "55", TxnType: "Invoice" });
    expect(p.PaymentRefNum).toBe("check");
  });
});
