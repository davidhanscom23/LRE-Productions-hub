import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  cleanCategory,
  formatCents,
  parseAmountToCents,
  summarize,
  type PartnerExpense,
} from "./shared";

function row(over: Partial<PartnerExpense>): PartnerExpense {
  return {
    id: "x",
    paid_by: "david",
    amount_cents: 1000,
    description: "thing",
    category: "other",
    expense_date: "2026-11-01",
    note: "",
    receipt_path: "",
    receipt_name: "",
    receipt_url: null,
    reimbursed_at: null,
    flagged_at: null,
    flag_note: "",
    voided_at: null,
    void_reason: "",
    created_by: "u1",
    created_at: "2026-11-01T00:00:00Z",
    ...over,
  };
}

describe("parseAmountToCents", () => {
  it("parses money formats", () => {
    expect(parseAmountToCents("1,250.50")).toBe(125050);
    expect(parseAmountToCents("$49.99")).toBe(4999);
    expect(parseAmountToCents("300")).toBe(30000);
    expect(parseAmountToCents(".5")).toBe(50);
  });
  it("rejects bad input", () => {
    for (const bad of ["", "abc", "0", "-5", "1.234", "12.3.4", ".", "1000000"]) {
      expect(parseAmountToCents(bad)).toBeNull();
    }
  });
});

describe("summarize", () => {
  const rows = [
    row({ id: "a", paid_by: "david", amount_cents: 125050, category: "equipment" }),
    row({ id: "b", paid_by: "luke", amount_cents: 30000, category: "software", expense_date: "2026-12-02" }),
    row({ id: "c", paid_by: "luke", amount_cents: 4999, category: "equipment", reimbursed_at: "2026-12-05T00:00:00Z" }),
    row({ id: "d", paid_by: "david", amount_cents: 99999, voided_at: "2026-11-02T00:00:00Z", void_reason: "dup" }),
    row({ id: "e", paid_by: "david", amount_cents: 1000, flagged_at: "2026-11-03T00:00:00Z" }),
  ];
  const s = summarize(rows);

  it("totals everything except voided rows", () => {
    expect(s.total).toBe(125050 + 30000 + 4999 + 1000);
    expect(s.count).toBe(4);
  });
  it("splits by person and reimbursement", () => {
    expect(s.david.total).toBe(126050);
    expect(s.david.outstanding).toBe(126050);
    expect(s.luke.total).toBe(34999);
    expect(s.luke.reimbursed).toBe(4999);
    expect(s.luke.outstanding).toBe(30000);
    expect(s.outstanding).toBe(126050 + 30000);
  });
  it("reports the gap and flags", () => {
    expect(s.gap).toBe(126050 - 34999);
    expect(s.flagged).toBe(1);
  });
  it("groups by category and month, biggest first / oldest first", () => {
    expect(s.byCategory[0].category).toBe("equipment");
    expect(s.byCategory[0].david + s.byCategory[0].luke).toBe(125050 + 4999);
    expect(s.byMonth.map((m) => m.month)).toEqual(["2026-11", "2026-12"]);
  });
  it("handles an empty ledger", () => {
    const e = summarize([]);
    expect(e.total).toBe(0);
    expect(e.byCategory).toEqual([]);
  });
});

describe("misc helpers", () => {
  it("falls back to other for unknown categories", () => {
    expect(cleanCategory("nope")).toBe("other");
    expect(cleanCategory("travel")).toBe("travel");
  });
  it("formats cents", () => {
    expect(formatCents(125050)).toBe("$1,250.50");
  });
  it("labels audit actions", () => {
    expect(auditActionLabel("voided")).toBe("Voided an expense");
    expect(auditActionLabel("something_new")).toBe("something_new");
  });
});
