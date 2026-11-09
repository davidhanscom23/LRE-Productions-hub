import { describe, expect, it } from "vitest";
import { isPacketOverdue } from "./overdue";

describe("isPacketOverdue", () => {
  const now = new Date("2026-08-07T15:00:00");

  it("marks incomplete past events overdue", () => {
    expect(
      isPacketOverdue(
        {
          status: "needs_completion",
          event_date: "2026-08-01",
          completion_optional: false,
        },
        now,
      ),
    ).toBe(true);
  });

  it("never marks completion_optional packets overdue", () => {
    expect(
      isPacketOverdue(
        {
          status: "needs_completion",
          event_date: "2024-01-01",
          completion_optional: true,
        },
        now,
      ),
    ).toBe(false);
  });

  it("ignores completed packets", () => {
    expect(
      isPacketOverdue(
        {
          status: "completed",
          event_date: "2026-08-01",
          completion_optional: false,
        },
        now,
      ),
    ).toBe(false);
  });
});
