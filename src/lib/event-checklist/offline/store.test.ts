// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createStore } from "./store";

const newOp = (clientId: string) => ({
  checklistId: "c1", kind: "check" as const, payload: { itemId: "i", pass: "out" as const, qty: 1 },
  clientId, createdAt: 1,
});

describe("offline store", () => {
  it("keeps ops in order across a reopen", async () => {
    const idb = new IDBFactory();
    const a = createStore(idb);
    await a.addOp(newOp("a"));
    await a.addOp(newOp("b"));
    const b = createStore(idb);
    expect((await b.listOps("c1")).map((o) => o.clientId)).toEqual(["a", "b"]);
  });
  it("stores and removes a photo with its op", async () => {
    const s = createStore(new IDBFactory());
    const op = await s.addOp(newOp("p"), new Blob(["x"]));
    expect(await s.getPhoto("p")).toBeTruthy();
    await s.removeOp(op.seq);
    expect(await s.getPhoto("p")).toBeNull();
    expect(await s.listOps("c1")).toHaveLength(0);
  });
  it("round-trips a snapshot and the attention list, and purges everything", async () => {
    const s = createStore(new IDBFactory());
    await s.saveSnapshot({ checklistId: "c1", loadedAt: 5, checklist: {} as never, items: [], history: [] });
    await s.addAttention({ checklistId: "c1", message: "oops", at: 1 });
    expect((await s.getSnapshot("c1"))?.loadedAt).toBe(5);
    expect(await s.listAttention("c1")).toHaveLength(1);
    await s.addOp(newOp("z"));
    await s.purge();
    expect(await s.getSnapshot("c1")).toBeNull();
    expect(await s.listAttention("c1")).toHaveLength(0);
    expect(await s.listOps("c1")).toHaveLength(0);
  });
});
