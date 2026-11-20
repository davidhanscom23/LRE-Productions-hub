/** Scans made with no signal wait on the phone and are sent once it is back online. */

import type { ScanDirection, ScanFlag } from "./types";

export type QueuedScan = {
  clientId: string;
  raw: string;
  direction: ScanDirection;
  projectId: string | null;
  flag: ScanFlag;
  note: string;
  /** ISO time the scan was made on the phone. */
  scannedAt: string;
};

export const QUEUE_KEY = "lre-gear-scan-queue-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isQueuedScan(v: unknown): v is QueuedScan {
  const s = v as QueuedScan | null;
  return (
    !!s &&
    typeof s.clientId === "string" &&
    typeof s.raw === "string" &&
    (s.direction === "out" || s.direction === "back") &&
    typeof s.scannedAt === "string"
  );
}

/** Add a scan; the same clientId is never queued twice. */
export function enqueue(list: QueuedScan[], scan: QueuedScan): QueuedScan[] {
  if (list.some((s) => s.clientId === scan.clientId)) return list;
  return [...list, scan];
}

export function dequeue(list: QueuedScan[], clientId: string): QueuedScan[] {
  return list.filter((s) => s.clientId !== clientId);
}

/** Never throws: private mode or a full disk just means an empty queue. */
export function readQueue(storage: StorageLike | null | undefined): QueuedScan[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isQueuedScan) : [];
  } catch {
    return [];
  }
}

/** Returns false when the phone would not save it, so the page can say so. */
export function writeQueue(storage: StorageLike | null | undefined, list: QueuedScan[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function newClientId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
