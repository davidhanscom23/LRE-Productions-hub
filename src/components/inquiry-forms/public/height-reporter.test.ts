import { describe, expect, it } from "vitest";
import { FALLBACK_DELAY_MS, startHeightReporter, type HeightReporterEnv } from "./height-reporter";

/** Deterministic env: manual rAF and timers, controllable observers. */
function fakeEnv(opts: { raf?: boolean; resize?: boolean; mutation?: boolean } = {}) {
  const rafQueue = new Map<number, () => void>();
  const timers = new Map<number, { cb: () => void; at: number }>();
  let nextId = 1;
  let now = 0;
  const resizeCallbacks: (() => void)[] = [];
  const mutationCallbacks: (() => void)[] = [];
  let loadCb: (() => void) | null = null;
  let disconnects = 0;

  class FakeRO {
    constructor(private cb: () => void) {
      resizeCallbacks.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      disconnects += 1;
    }
  }
  class FakeMO {
    constructor(private cb: () => void) {
      mutationCallbacks.push(cb);
    }
    observe() {}
    disconnect() {
      disconnects += 1;
    }
    takeRecords() {
      return [];
    }
  }

  const env: HeightReporterEnv = {
    requestAnimationFrame:
      opts.raf === false
        ? undefined
        : (cb) => {
            const id = nextId++;
            rafQueue.set(id, cb);
            return id;
          },
    cancelAnimationFrame: (id) => {
      rafQueue.delete(id);
    },
    setTimeout: (cb, ms) => {
      const id = nextId++;
      timers.set(id, { cb, at: now + ms });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id as number);
    },
    ResizeObserver: opts.resize === false ? undefined : (FakeRO as unknown as typeof ResizeObserver),
    MutationObserver: opts.mutation === false ? undefined : (FakeMO as unknown as typeof MutationObserver),
    addLoadListener: (cb) => {
      loadCb = cb;
      return () => {
        loadCb = null;
      };
    },
    fontsReady: null,
  };

  return {
    env,
    frame() {
      const cbs = Array.from(rafQueue.values());
      rafQueue.clear();
      cbs.forEach((cb) => cb());
    },
    advance(ms: number) {
      now += ms;
      for (const [id, t] of Array.from(timers.entries())) {
        if (t.at <= now) {
          timers.delete(id);
          t.cb();
        }
      }
    },
    resize() {
      resizeCallbacks.forEach((cb) => cb());
    },
    mutate() {
      mutationCallbacks.forEach((cb) => cb());
    },
    load() {
      loadCb?.();
    },
    get pending() {
      return rafQueue.size + timers.size;
    },
    get disconnects() {
      return disconnects;
    },
  };
}

describe("startHeightReporter", () => {
  it("reports the first height, coalesces bursts into one frame and never repeats a height", () => {
    const h = fakeEnv();
    let height = 640;
    const reports: number[] = [];
    startHeightReporter(document.createElement("div"), (v) => reports.push(v), h.env, () => height);
    h.frame();
    expect(reports).toEqual([640]);

    h.resize();
    h.mutate();
    h.mutate();
    h.frame();
    expect(reports).toEqual([640]); // same height, nothing posted

    height = 420; // a shorter step: the frame must be allowed to shrink
    h.mutate();
    h.resize();
    h.frame();
    expect(reports).toEqual([640, 420]);
  });

  it("still reports when animation frames are paused (off-screen cross-origin iframe)", () => {
    const h = fakeEnv({ resize: false });
    let height = 300;
    const reports: number[] = [];
    startHeightReporter(document.createElement("div"), (v) => reports.push(v), h.env, () => height);
    h.advance(FALLBACK_DELAY_MS);
    expect(reports).toEqual([300]);
    height = 502;
    h.mutate(); // ResizeObserver is silent here; DOM mutations still arrive
    h.advance(FALLBACK_DELAY_MS);
    expect(reports).toEqual([300, 502]);
  });

  it("works without requestAnimationFrame at all", () => {
    const h = fakeEnv({ raf: false });
    const reports: number[] = [];
    startHeightReporter(document.createElement("div"), (v) => reports.push(v), h.env, () => 777);
    h.advance(FALLBACK_DELAY_MS);
    expect(reports).toEqual([777]);
  });

  it("re-measures on window load (late images and fonts)", () => {
    const h = fakeEnv();
    let height = 500;
    const reports: number[] = [];
    startHeightReporter(document.createElement("div"), (v) => reports.push(v), h.env, () => height);
    h.frame();
    height = 560;
    h.load();
    h.frame();
    expect(reports).toEqual([500, 560]);
  });

  it("ignores a zero height (detached or hidden content)", () => {
    const h = fakeEnv();
    const reports: number[] = [];
    startHeightReporter(document.createElement("div"), (v) => reports.push(v), h.env, () => 0);
    h.frame();
    expect(reports).toEqual([]);
  });

  it("stop() disconnects both observers and cancels pending work", () => {
    const h = fakeEnv();
    const reports: number[] = [];
    const stop = startHeightReporter(document.createElement("div"), (v) => reports.push(v), h.env, () => 600);
    stop();
    expect(h.disconnects).toBe(2);
    expect(h.pending).toBe(0);
    h.mutate();
    h.frame();
    h.advance(1000);
    expect(reports).toEqual([]);
  });
});
