import { describe, expect, it } from "vitest";
import {
  isInvoiceOverdue,
  shouldSendInvoiceReminder,
} from "./invoice-overdue";

describe("isInvoiceOverdue", () => {
  it("flags past-due unpaid sent invoices", () => {
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueAt: "2026-10-01",
        total: 1000,
        amountPaid: 100,
        amountCredited: 0,
        todayYmd: "2026-11-01",
      }),
    ).toBe(true);
  });

  it("ignores draft, paid, void, future due, and zero balance", () => {
    expect(
      isInvoiceOverdue({
        status: "draft",
        dueAt: "2026-10-01",
        total: 1000,
        amountPaid: 0,
        todayYmd: "2026-11-01",
      }),
    ).toBe(false);
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueAt: "2026-12-01",
        total: 1000,
        amountPaid: 0,
        todayYmd: "2026-11-01",
      }),
    ).toBe(false);
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueAt: "2026-10-01",
        total: 1000,
        amountPaid: 1000,
        todayYmd: "2026-11-01",
      }),
    ).toBe(false);
  });
});

describe("shouldSendInvoiceReminder", () => {
  it("allows first send and blocks recent duplicates", () => {
    expect(shouldSendInvoiceReminder({ lastRemindedAt: null })).toBe(true);
    const now = new Date("2026-11-01T16:00:00.000Z");
    expect(
      shouldSendInvoiceReminder({
        lastRemindedAt: "2026-11-01T10:00:00.000Z",
        now,
        dedupeHours: 20,
      }),
    ).toBe(false);
    expect(
      shouldSendInvoiceReminder({
        lastRemindedAt: "2026-10-31T10:00:00.000Z",
        now,
        dedupeHours: 20,
      }),
    ).toBe(true);
  });
});
