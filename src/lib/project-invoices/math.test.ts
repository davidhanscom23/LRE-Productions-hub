import { describe, expect, it } from "vitest";
import { allocatePayments, buildPlan, computeTotals, deriveStatus, nextPayable } from "./math";

describe("project invoice math", () => {
  it("totals lines with tax", () => {
    expect(computeTotals([{ description: "a", qty: 2, unit_price: 10.5 }, { description: "b", qty: 1, unit_price: 79 }], 7)).toEqual({
      subtotal: 100,
      tax: 7,
      total: 107,
    });
  });

  it("plans add up to the cent", () => {
    for (const total of [100, 99.99, 1000.01, 333.33]) {
      for (const kind of ["full", "retainer_balance", "thirds"] as const) {
        const plan = buildPlan({ kind, total, issuedAt: "2026-11-01", eventDate: "2027-06-05" });
        expect(Math.round(plan.reduce((s, p) => s + p.amount, 0) * 100)).toBe(Math.round(total * 100));
      }
    }
  });

  it("retainer plan sets the balance 14 days before the event and never before issue", () => {
    const p = buildPlan({ kind: "retainer_balance", total: 1000, issuedAt: "2026-11-01", eventDate: "2027-06-05" });
    expect(p[0]).toMatchObject({ amount: 500, due_at: "2026-11-01" });
    expect(p[1]).toMatchObject({ amount: 500, due_at: "2027-05-22" });
    const soon = buildPlan({ kind: "retainer_balance", total: 1000, issuedAt: "2026-11-01", eventDate: "2026-11-05" });
    expect(soon[1].due_at).toBe("2026-11-01");
    expect(buildPlan({ kind: "retainer_balance", total: 0, issuedAt: "2026-11-01" })).toEqual([]);
  });

  it("applies payments in order and flags overdue", () => {
    const plan = buildPlan({ kind: "retainer_balance", total: 1000, issuedAt: "2026-10-01", eventDate: "2026-12-25" });
    const s = allocatePayments(plan, 600, "2026-11-20");
    expect(s[0]).toMatchObject({ paid: 500, remaining: 0, overdue: false });
    expect(s[1]).toMatchObject({ paid: 100, remaining: 400, overdue: false });
    expect(allocatePayments(plan, 0, "2026-11-20")[0].overdue).toBe(true);
    expect(nextPayable(s, 400)).toEqual({ label: "Final balance", amount: 400 });
    expect(nextPayable(s, 0)).toBeNull();
  });

  it("derives status", () => {
    expect(deriveStatus({ current: "sent", total: 100, amountPaid: 0 })).toBe("sent");
    expect(deriveStatus({ current: "sent", total: 100, amountPaid: 40 })).toBe("partial");
    expect(deriveStatus({ current: "partial", total: 100, amountPaid: 100 })).toBe("paid");
    expect(deriveStatus({ current: "void", total: 100, amountPaid: 100 })).toBe("void");
    expect(deriveStatus({ current: "draft", total: 100, amountPaid: 0 })).toBe("draft");
  });
});
