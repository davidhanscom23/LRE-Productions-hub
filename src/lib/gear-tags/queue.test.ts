import { describe, expect, it } from "vitest";
import { QUEUE_KEY, dequeue, enqueue, newClientId, readQueue, writeQueue, type QueuedScan } from "./queue";

function scan(clientId: string): QueuedScan {
  return {
    clientId,
    raw: "0001",
    direction: "out",
    projectId: null,
    flag: "none",
    note: "",
    scannedAt: "2026-11-20T18:00:00.000Z",
  };
}

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(QUEUE_KEY, initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("gear scan queue", () => {
  it("adds a scan once", () => {
    const one = enqueue([], scan("a"));
    expect(one).toHaveLength(1);
    expect(enqueue(one, scan("a"))).toHaveLength(1);
    expect(enqueue(one, scan("b"))).toHaveLength(2);
  });

  it("removes a sent scan", () => {
    expect(dequeue([scan("a"), scan("b")], "a").map((s) => s.clientId)).toEqual(["b"]);
  });

  it("survives a round trip through storage", () => {
    const store = memory();
    expect(writeQueue(store, [scan("a")])).toBe(true);
    expect(readQueue(store)).toEqual([scan("a")]);
  });

  it("treats missing, broken or foreign storage as an empty queue", () => {
    expect(readQueue(null)).toEqual([]);
    expect(readQueue(memory("not json"))).toEqual([]);
    expect(readQueue(memory('{"a":1}'))).toEqual([]);
    expect(readQueue(memory('[{"clientId":1},null,"x"]'))).toEqual([]);
  });

  it("reports when the phone refuses to save", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(writeQueue(full, [scan("a")])).toBe(false);
    expect(writeQueue(null, [scan("a")])).toBe(false);
  });

  it("makes distinct client ids", () => {
    expect(newClientId()).not.toBe(newClientId());
  });
});
