/** Offline queue: operation types and the pure rules for coalescing, retrying and classifying results. */
import type { ChecklistFlag, ChecklistPass, ChecklistSource } from "../types";

export type OpPayloads = {
  check: {
    itemId: string;
    pass: ChecklistPass;
    qty: number;
    flag?: ChecklistFlag;
    note?: string;
    photoPath?: string | null;
  };
  addItem: {
    id: string;
    checklistId: string;
    name: string;
    qty: number;
    source: ChecklistSource;
    productId?: string | null;
    returns?: boolean;
  };
  removeItem: { itemId: string };
  setSource: { itemId: string; source: ChecklistSource };
  schedule: { checklistId: string; departAt: string; returnAt: string };
};

export type OpKind = keyof OpPayloads;

export type QueuedOp<K extends OpKind = OpKind> = {
  /** Auto-increment key in IndexedDB; defines send order. */
  seq: number;
  checklistId: string;
  kind: K;
  payload: OpPayloads[K];
  /** Stable id: used as the check's client_id so a replay is harmless. */
  clientId: string;
  createdAt: number;
  attempts: number;
  /** Key of a photo Blob waiting in the photos store (checks only). */
  photoKey?: string | null;
};

export type NewOp = Omit<QueuedOp, "seq" | "attempts">;

export type SendResult =
  | { status: "ok" }
  | { status: "permanent"; error: string }
  | { status: "transient"; error: string }
  | { status: "auth"; error: string };

const MAX_ATTEMPTS = 6;

/** Last write wins for these, so only the newest one per target needs to be kept. */
function coalesceKey(op: Pick<QueuedOp, "kind" | "payload" | "checklistId">): string | null {
  if (op.kind === "setSource") return `setSource:${(op.payload as OpPayloads["setSource"]).itemId}`;
  if (op.kind === "schedule") return `schedule:${op.checklistId}`;
  return null;
}

/** Sequence numbers of queued ops that a new last-write-wins op replaces. */
export function supersededSeqs(
  queue: Pick<QueuedOp, "seq" | "kind" | "payload" | "checklistId">[],
  op: Pick<QueuedOp, "kind" | "payload" | "checklistId">,
): number[] {
  const key = coalesceKey(op);
  if (!key) return [];
  return queue.filter((q) => coalesceKey(q) === key).map((q) => q.seq);
}

/** Add an op to the queue, dropping an older op it replaces. Checks are never merged. */
export function enqueue<T extends Pick<QueuedOp, "kind" | "payload" | "checklistId">>(
  queue: T[],
  op: T,
): T[] {
  const key = coalesceKey(op);
  const kept = key ? queue.filter((q) => coalesceKey(q) !== key) : queue;
  return [...kept, op];
}

/** Retry delay: 2s doubling to 5 minutes, with jitter (rand in [0,1)). */
export function backoffMs(attempts: number, rand = Math.random()): number {
  const base = Math.min(300_000, 2000 * 2 ** Math.max(0, attempts));
  return Math.round(base * (0.75 + rand * 0.5));
}

export function giveUp(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

/** Turn a server action reply into a queue decision. */
export function classify(reply: { ok: boolean; error?: string } | undefined | null): SendResult {
  if (reply?.ok) return { status: "ok" };
  const error = reply?.error ?? "Something went wrong.";
  if (/signed in/i.test(error)) return { status: "auth", error };
  // Validation / "you can't" replies will never succeed on a retry.
  if (
    /removed|can't|cannot|nothing to change|pick out|give the item|quantity must|unknown|sold or used|only items added|return time/i.test(
      error,
    )
  ) {
    return { status: "permanent", error };
  }
  return { status: "transient", error };
}

/** Plain-English line for the Needs attention panel. */
export function describeOp(op: Pick<QueuedOp, "kind" | "payload">, itemName?: string): string {
  const name = itemName ? `“${itemName}”` : "an item";
  switch (op.kind) {
    case "check": {
      const p = op.payload as OpPayloads["check"];
      if (p.flag && p.flag !== "none") return `Your ${p.flag} flag on ${name}`;
      return `Your ${p.qty < 0 ? "uncheck" : "check"} of ${Math.abs(p.qty)} for ${name}`;
    }
    case "addItem":
      return `Adding “${(op.payload as OpPayloads["addItem"]).name}”`;
    case "removeItem":
      return `Removing ${name}`;
    case "setSource":
      return `Changing where ${name} comes from`;
    case "schedule":
      return "Saving the schedule times";
  }
}
