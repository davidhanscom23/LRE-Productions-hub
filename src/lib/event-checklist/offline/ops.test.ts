import { describe, expect, it } from "vitest";
import type { QueuedOp } from "./ops";
import { backoffMs, classify, enqueue, giveUp, supersededSeqs } from "./ops";

type Mk = { kind: QueuedOp["kind"]; payload: QueuedOp["payload"]; checklistId: string };
const mk = (kind: "check" | "setSource" | "schedule", payload: object, checklistId = "c1") =>
  ({ kind, payload, checklistId }) as unknown as Mk;

describe("enqueue", () => {
  it("never merges checks", () => {
    const q = enqueue(enqueue([], mk("check", { itemId: "a", qty: 1 })), mk("check", { itemId: "a", qty: 1 }));
    expect(q).toHaveLength(2);
  });
  it("keeps only the latest source change per item", () => {
    let q = enqueue([], mk("setSource", { itemId: "a", source: "in_house" }));
    q = enqueue(q, mk("setSource", { itemId: "b", source: "in_house" }));
    q = enqueue(q, mk("setSource", { itemId: "a", source: "sub_rented" }));
    expect(q).toHaveLength(2);
    expect((q[1].payload as { source: string }).source).toBe("sub_rented");
  });
  it("keeps only the latest schedule per checklist", () => {
    let q = enqueue([], mk("schedule", { departAt: "1" }));
    q = enqueue(q, mk("schedule", { departAt: "2" }, "c2"));
    q = enqueue(q, mk("schedule", { departAt: "3" }));
    expect(q).toHaveLength(2);
  });
});

describe("backoff", () => {
  it("grows and caps at about five minutes", () => {
    expect(backoffMs(0, 0.5)).toBe(2000);
    expect(backoffMs(1, 0.5)).toBe(4000);
    expect(backoffMs(20, 0.5)).toBe(300000);
    expect(backoffMs(20, 0.99)).toBeLessThanOrEqual(375000);
  });
  it("gives up after six attempts", () => {
    expect(giveUp(5)).toBe(false);
    expect(giveUp(6)).toBe(true);
  });
});

describe("classify", () => {
  it("ok", () => expect(classify({ ok: true }).status).toBe("ok"));
  it("sign-in problems pause the queue", () => expect(classify({ ok: false, error: "You must be signed in." }).status).toBe("auth"));
  it("known refusals are permanent", () => {
    expect(classify({ ok: false, error: "This item was removed from the list." }).status).toBe("permanent");
    expect(classify({ ok: false, error: "Nothing to change." }).status).toBe("permanent");
  });
  it("unknown errors are retried", () => expect(classify({ ok: false, error: "fetch failed" }).status).toBe("transient"));
});

describe("supersededSeqs", () => {
  it("finds the older ops a new source change replaces", () => {
    const q = [
      { seq: 1, ...mk("setSource", { itemId: "a" }) },
      { seq: 2, ...mk("setSource", { itemId: "b" }) },
      { seq: 3, ...mk("check", { itemId: "a" }) },
    ];
    expect(supersededSeqs(q, mk("setSource", { itemId: "a" }))).toEqual([1]);
    expect(supersededSeqs(q, mk("check", { itemId: "a" }))).toEqual([]);
  });
});
