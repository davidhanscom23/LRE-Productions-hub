/**
 * Inquiry Forms builder - undo / redo history.
 *
 * Pure reducer helpers (unit tested) plus a tiny React hook. Every builder edit goes through
 * `set`, so every edit is undoable (the LeadGate builder only recorded a few edit kinds).
 *
 * Typing coalesces: edits that carry the same `key` within COALESCE_MS of each other merge
 * into one history entry, so undo after typing a label restores the whole label, not one
 * character at a time.
 */
import { useCallback, useState } from "react";

export const HISTORY_LIMIT = 50;
export const COALESCE_MS = 1000;

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  /** Coalesce key of the most recent edit (null after undo / redo / reset). */
  lastKey: string | null;
  /** Timestamp (ms) of the most recent edit. */
  lastAt: number;
  /** Bumped by every change (edit, undo, redo, reset): lets callers tell whether anything happened since. */
  version: number;
}

export function historyInit<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0, version: 0 };
}

export interface PushOptions {
  /** Same key within COALESCE_MS = merge into the previous entry. */
  key?: string | null;
  now?: number;
  limit?: number;
}

export function historyPush<T>(h: HistoryState<T>, next: T, opts: PushOptions = {}): HistoryState<T> {
  if (Object.is(next, h.present)) return h;
  const now = opts.now ?? 0;
  const key = opts.key ?? null;
  const limit = Math.max(1, opts.limit ?? HISTORY_LIMIT);
  if (key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS && h.past.length > 0) {
    return { past: h.past, present: next, future: [], lastKey: key, lastAt: now, version: h.version + 1 };
  }
  const past = [...h.past, h.present];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, present: next, future: [], lastKey: key, lastAt: now, version: h.version + 1 };
}

export function historyUndo<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
    lastKey: null,
    lastAt: 0,
    version: h.version + 1,
  };
}

export function historyRedo<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future;
  return {
    past: [...h.past, h.present],
    present: next,
    future: rest,
    lastKey: null,
    lastAt: 0,
    version: h.version + 1,
  };
}

/** Ends the current typing burst so the next edit starts a new entry. */
export function historyBreak<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.lastKey === null) return h;
  return { ...h, lastKey: null };
}

export interface HistoryApi<T> {
  present: T;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  /** Changes on every edit, undo, redo and reset. */
  version: number;
  /** Apply an edit. Return the same object from the updater to record nothing. */
  set: (updater: (prev: T) => T, key?: string | null) => void;
  undo: () => void;
  redo: () => void;
  /** Replace everything (e.g. after loading the latest saved version). Clears undo and redo. */
  reset: (next: T) => void;
  /** Close the current typing burst (call on blur). */
  breakCoalesce: () => void;
}

export function useHistory<T>(initial: () => T): HistoryApi<T> {
  const [h, setH] = useState<HistoryState<T>>(() => historyInit(initial()));

  const set = useCallback((updater: (prev: T) => T, key?: string | null) => {
    setH((prev) => historyPush(prev, updater(prev.present), { key: key ?? null, now: Date.now() }));
  }, []);
  const undo = useCallback(() => setH((prev) => historyUndo(prev)), []);
  const redo = useCallback(() => setH((prev) => historyRedo(prev)), []);
  const reset = useCallback((next: T) => setH((prev) => ({ ...historyInit(next), version: prev.version + 1 })), []);
  const breakCoalesce = useCallback(() => setH((prev) => historyBreak(prev)), []);

  return {
    present: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    undoCount: h.past.length,
    redoCount: h.future.length,
    version: h.version,
    set,
    undo,
    redo,
    reset,
    breakCoalesce,
  };
}
