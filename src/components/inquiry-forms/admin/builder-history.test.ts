import { describe, expect, it } from "vitest";
import {
  COALESCE_MS,
  HISTORY_LIMIT,
  historyBreak,
  historyInit,
  historyPush,
  historyRedo,
  historyUndo,
} from "./builder-history";

describe("builder history", () => {
  it("records every edit and undoes / redoes in order", () => {
    let h = historyInit("a");
    h = historyPush(h, "b", { now: 1 });
    h = historyPush(h, "c", { now: 2 });
    expect(h.present).toBe("c");
    h = historyUndo(h);
    expect(h.present).toBe("b");
    h = historyUndo(h);
    expect(h.present).toBe("a");
    h = historyUndo(h);
    expect(h.present).toBe("a");
    h = historyRedo(h);
    h = historyRedo(h);
    expect(h.present).toBe("c");
    h = historyRedo(h);
    expect(h.present).toBe("c");
  });

  it("ignores a no-op edit (same object)", () => {
    const start = { v: 1 };
    const h = historyInit(start);
    expect(historyPush(h, start, { now: 5 })).toBe(h);
  });

  it("a new edit after undo clears the redo stack", () => {
    let h = historyInit(1);
    h = historyPush(h, 2, { now: 1 });
    h = historyPush(h, 3, { now: 2 });
    h = historyUndo(h);
    h = historyPush(h, 4, { now: 3 });
    expect(h.future).toEqual([]);
    expect(historyRedo(h).present).toBe(4);
    expect(historyUndo(h).present).toBe(2);
  });

  it("caps the past at the history limit (50 deep)", () => {
    let h = historyInit(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = historyPush(h, i, { now: i * 10_000 });
    expect(h.past.length).toBe(HISTORY_LIMIT);
    let undone = h;
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) undone = historyUndo(undone);
    expect(undone.present).toBe(20);
  });

  it("coalesces a typing burst with the same key into one entry", () => {
    let h = historyInit("");
    h = historyPush(h, "H", { key: "label:1", now: 1000 });
    h = historyPush(h, "Hi", { key: "label:1", now: 1000 + COALESCE_MS - 1 });
    h = historyPush(h, "Hi!", { key: "label:1", now: 1000 + 2 * COALESCE_MS - 2 });
    expect(h.past).toEqual([""]);
    expect(historyUndo(h).present).toBe("");
  });

  it("starts a new entry after a pause, a different key, or a break", () => {
    let h = historyInit("");
    h = historyPush(h, "a", { key: "k", now: 0 });
    h = historyPush(h, "ab", { key: "k", now: COALESCE_MS + 5 });
    expect(h.past).toEqual(["", "a"]);

    h = historyPush(h, "abc", { key: "other", now: COALESCE_MS + 6 });
    expect(h.past).toEqual(["", "a", "ab"]);

    h = historyBreak(h);
    h = historyPush(h, "abcd", { key: "other", now: COALESCE_MS + 7 });
    expect(h.past).toEqual(["", "a", "ab", "abc"]);
  });

  it("does not coalesce edits without a key", () => {
    let h = historyInit(0);
    h = historyPush(h, 1, { now: 1 });
    h = historyPush(h, 2, { now: 2 });
    expect(h.past).toEqual([0, 1]);
  });

  it("bumps the version on every change and not on a no-op", () => {
    let h = historyInit({ n: 0 });
    const v0 = h.version;
    h = historyPush(h, { n: 1 }, { now: 1 });
    expect(h.version).toBe(v0 + 1);
    h = historyPush(h, { n: 2 }, { key: "k", now: 2 });
    h = historyPush(h, { n: 3 }, { key: "k", now: 3 });
    expect(h.version).toBe(v0 + 3);
    const same = historyPush(h, h.present, { now: 4 });
    expect(same.version).toBe(h.version);
    h = historyUndo(h);
    expect(h.version).toBe(v0 + 4);
    h = historyRedo(h);
    expect(h.version).toBe(v0 + 5);
    expect(historyUndo(historyInit(1)).version).toBe(0);
  });

  it("undo ends a typing burst so the next keystroke is its own entry", () => {
    let h = historyInit("");
    h = historyPush(h, "a", { key: "k", now: 0 });
    h = historyUndo(h);
    h = historyPush(h, "b", { key: "k", now: 1 });
    expect(h.past).toEqual([""]);
    expect(h.present).toBe("b");
  });
});
