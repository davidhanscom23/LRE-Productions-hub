import { describe, expect, it } from "vitest";
import type { QueuedOp, SendResult } from "./ops";
import { runSync, type SyncDeps } from "./sync";

function harness(initial: QueuedOp[], reply: (ops: QueuedOp[]) => ({ seq: number } & SendResult)[] | Error) {
  const queue = [...initial];
  const failed: string[] = [];
  const sentBatches: number[][] = [];
  const deps: SyncDeps = {
    list: async () => [...queue].sort((a, b) => a.seq - b.seq),
    remove: async (seq) => { queue.splice(queue.findIndex((o) => o.seq === seq), 1); },
    bumpAttempts: async (seq) => { queue.find((o) => o.seq === seq)!.attempts++; },
    fail: async (_op, e) => { failed.push(e); },
    uploadPhoto: async (op) => `chk/${op.clientId}.jpg`,
    send: async (ops) => {
      sentBatches.push(ops.map((o) => o.seq));
      const r = reply(ops);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { deps, queue, failed, sentBatches };
}
const op = (seq: number, extra: Partial<QueuedOp> = {}) =>
  ({ seq, checklistId: "c1", kind: "check", payload: { itemId: "i", pass: "out", qty: 1 }, clientId: `k${seq}`, createdAt: 0, attempts: 0, ...extra }) as QueuedOp;
const ok = (ops: QueuedOp[]) => ops.map((o) => ({ seq: o.seq, status: "ok" as const }));

describe("runSync", () => {
  it("sends in order and empties the queue", async () => {
    const h = harness([op(2), op(1), op(3)], ok);
    const out = await runSync(h.deps);
    expect(h.sentBatches[0]).toEqual([1, 2, 3]);
    expect(h.queue).toHaveLength(0);
    expect(out).toMatchObject({ state: "synced", sent: 3 });
  });
  it("stops at a transient failure and keeps the rest queued", async () => {
    const h = harness([op(1), op(2), op(3)], (ops) => [
      { seq: ops[0].seq, status: "ok" }, { seq: ops[1].seq, status: "transient", error: "boom" },
    ]);
    const out = await runSync(h.deps);
    expect(h.queue.map((o) => o.seq)).toEqual([2, 3]);
    expect(h.queue[0].attempts).toBe(1);
    expect(out.state).toBe("retry");
  });
  it("goes offline when the request throws, changing nothing", async () => {
    const h = harness([op(1)], () => new Error("network"));
    expect((await runSync(h.deps)).state).toBe("offline");
    expect(h.queue).toHaveLength(1);
  });
  it("moves a permanent failure to needs attention and carries on", async () => {
    const h = harness([op(1), op(2)], (ops) => [
      { seq: ops[0].seq, status: "permanent", error: "removed" }, { seq: ops[1].seq, status: "ok" },
    ]);
    const out = await runSync(h.deps);
    expect(h.failed).toEqual(["removed"]);
    expect(h.queue).toHaveLength(0);
    expect(out).toMatchObject({ state: "synced", sent: 1, failed: 1 });
  });
  it("pauses on a sign-in problem and keeps everything", async () => {
    const h = harness([op(1)], (ops) => [{ seq: ops[0].seq, status: "auth", error: "signed in" }]);
    expect((await runSync(h.deps)).state).toBe("auth");
    expect(h.queue).toHaveLength(1);
  });
  it("uploads the photo before sending and passes the path", async () => {
    let seen: unknown;
    const h = harness([op(1, { photoKey: "k1" })], (ops) => { seen = ops[0].payload; return ok(ops); });
    await runSync(h.deps);
    expect((seen as { photoPath: string }).photoPath).toBe("chk/k1.jpg");
  });
  it("gives up after too many tries", async () => {
    const h = harness([op(1, { attempts: 5 })], (ops) => [{ seq: ops[0].seq, status: "transient", error: "still failing" }]);
    const out = await runSync(h.deps);
    expect(h.failed).toEqual(["still failing"]);
    expect(h.queue).toHaveLength(0);
    expect(out.state).toBe("synced");
  });
});
