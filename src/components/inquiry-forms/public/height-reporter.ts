/**
 * Inquiry Forms public renderer - content height reporter for the embed iframe.
 *
 * Measures ONE content wrapper (never body.scrollHeight, never a 100vh root, so the frame can shrink) and
 * reports whenever it changes:
 * - ResizeObserver for layout changes;
 * - MutationObserver as well, because Chrome stops the rendering lifecycle (and ResizeObserver callbacks)
 *   for an off-screen cross-origin iframe while DOM mutations still run (KM Hub measured an iframe stuck
 *   at 303px with 502px of content);
 * - window load and document.fonts.ready (late images and the web font change the height).
 * Measurements are coalesced into one per animation frame, with a timer fallback because
 * requestAnimationFrame is paused in that same off-screen case. The same height is never reported twice.
 */

export interface HeightReporterEnv {
  requestAnimationFrame?: (cb: () => void) => number;
  cancelAnimationFrame?: (id: number) => void;
  setTimeout: (cb: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  ResizeObserver?: typeof ResizeObserver;
  MutationObserver?: typeof MutationObserver;
  addLoadListener?: (cb: () => void) => () => void;
  fontsReady?: Promise<unknown> | null;
}

export const FALLBACK_DELAY_MS = 120;

export function measureHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  return Math.ceil(Math.max(el.scrollHeight, el.offsetHeight || 0, rect.height || 0));
}

function browserEnv(): HeightReporterEnv {
  const w = window;
  return {
    requestAnimationFrame: typeof w.requestAnimationFrame === "function" ? (cb) => w.requestAnimationFrame(cb) : undefined,
    cancelAnimationFrame: typeof w.cancelAnimationFrame === "function" ? (id) => w.cancelAnimationFrame(id) : undefined,
    setTimeout: (cb, ms) => w.setTimeout(cb, ms),
    clearTimeout: (id) => w.clearTimeout(id as number),
    ResizeObserver: typeof w.ResizeObserver === "function" ? w.ResizeObserver : undefined,
    MutationObserver: typeof w.MutationObserver === "function" ? w.MutationObserver : undefined,
    addLoadListener: (cb) => {
      if (document.readyState === "complete") return () => undefined;
      w.addEventListener("load", cb);
      return () => w.removeEventListener("load", cb);
    },
    fontsReady: typeof document !== "undefined" && document.fonts ? document.fonts.ready : null,
  };
}

/**
 * Start reporting `el`'s height. Returns a stop function that disconnects every observer and timer.
 * `measure` is injectable for tests (jsdom has no layout).
 */
export function startHeightReporter(
  el: HTMLElement,
  report: (height: number) => void,
  env: HeightReporterEnv = browserEnv(),
  measure: (el: HTMLElement) => number = measureHeight,
): () => void {
  let last = -1;
  let stopped = false;
  let rafId: number | null = null;
  let timerId: unknown = null;

  const run = () => {
    if (rafId !== null && env.cancelAnimationFrame) env.cancelAnimationFrame(rafId);
    if (timerId !== null) env.clearTimeout(timerId);
    rafId = null;
    timerId = null;
    if (stopped) return;
    const h = measure(el);
    if (h > 0 && h !== last) {
      last = h;
      report(h);
    }
  };

  const schedule = () => {
    if (stopped || rafId !== null || timerId !== null) return;
    if (env.requestAnimationFrame) rafId = env.requestAnimationFrame(run);
    timerId = env.setTimeout(run, FALLBACK_DELAY_MS);
  };

  const ro = env.ResizeObserver ? new env.ResizeObserver(() => schedule()) : null;
  ro?.observe(el);
  const mo = env.MutationObserver ? new env.MutationObserver(() => schedule()) : null;
  mo?.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });
  const removeLoad = env.addLoadListener ? env.addLoadListener(schedule) : () => undefined;
  env.fontsReady?.then(schedule, () => undefined);

  schedule();

  return () => {
    stopped = true;
    ro?.disconnect();
    mo?.disconnect();
    removeLoad();
    if (rafId !== null && env.cancelAnimationFrame) env.cancelAnimationFrame(rafId);
    if (timerId !== null) env.clearTimeout(timerId);
    rafId = null;
    timerId = null;
  };
}
