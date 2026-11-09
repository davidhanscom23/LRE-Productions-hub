/** The sync engine: sends queued ops in order and decides what happens to each. Storage and network are injected. */
import { giveUp, type QueuedOp, type SendResult } from "./ops";

export type SyncDeps = {
  /** Ops for one checklist, oldest first. */
  list: () => Promise<QueuedOp[]>;
  remove: (seq: number) => Promise<void>;
  bumpAttempts: (seq: number) => Promise<void>;
  /** Move a failed op out of the queue into the Needs attention list. */
  fail: (op: QueuedOp, error: string) => Promise<void>;
  /** Upload a waiting photo and return its storage path (null/throw = could not). */
  uploadPhoto: (op: QueuedOp) => Promise<string | null>;
  /** POST ops to the server; throws on a network error or an unreadable reply. */
  send: (ops: QueuedOp[]) => Promise<({ seq: number } & SendResult)[]>;
};

export type SyncOutcome =
  | { state: "idle"; sent: number }
  | { state: "synced"; sent: number; failed: number }
  | { state: "offline" }
  | { state: "auth" }
  | { state: "retry"; sent: number };

export async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  let sent = 0;
  let failed = 0;
  // Several rounds so ops added while syncing are picked up.
  for (let round = 0; round < 5; round++) {
    const ops = await deps.list();
    if (ops.length === 0) return sent + failed === 0 ? { state: "idle", sent } : { state: "synced", sent, failed };

    // Photos first: a check goes out with the stored path, or without a photo if the upload cannot work.
    const ready: QueuedOp[] = [];
    for (const op of ops) {
      if (op.kind === "check" && op.photoKey) {
        try {
          const path = await deps.uploadPhoto(op);
          ready.push({ ...op, payload: { ...(op.payload as object), photoPath: path } as QueuedOp["payload"] });
        } catch {
          // Photo upload failed (likely still offline): stop here and retry later, keeping order.
          if (ready.length === 0) return { state: "offline" };
          break;
        }
      } else {
        ready.push(op);
      }
    }

    let results: ({ seq: number } & SendResult)[];
    try {
      results = await deps.send(ready);
    } catch {
      return { state: "offline" };
    }

    const bySeq = new Map(results.map((r) => [r.seq, r]));
    let blocked: "auth" | "retry" | null = null;
    for (const op of ready) {
      const r = bySeq.get(op.seq);
      if (!r) break; // server stopped before this one
      if (r.status === "ok") {
        await deps.remove(op.seq);
        sent++;
      } else if (r.status === "permanent") {
        await deps.fail(op, r.error);
        await deps.remove(op.seq);
        failed++;
      } else if (r.status === "auth") {
        blocked = "auth";
        break;
      } else {
        const attempts = op.attempts + 1;
        if (giveUp(attempts)) {
          await deps.fail(op, r.error);
          await deps.remove(op.seq);
          failed++;
          continue;
        }
        await deps.bumpAttempts(op.seq);
        blocked = "retry";
        break;
      }
    }
    if (blocked === "auth") return { state: "auth" };
    if (blocked === "retry") return { state: "retry", sent };
    if (results.length === 0) break;
  }
  return { state: "synced", sent, failed };
}

