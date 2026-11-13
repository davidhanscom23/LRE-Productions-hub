/** IndexedDB storage for the offline checklist: last board snapshot, queued ops, waiting photos, failed ops. */
import type { ChecklistHistoryRow, ChecklistItem, Checklist } from "../types";
import type { NewOp, QueuedOp } from "./ops";

const DB_NAME = "lre-checklist-offline";
const DB_VERSION = 1;

export type Snapshot = {
  checklistId: string;
  loadedAt: number;
  checklist: Checklist;
  items: ChecklistItem[];
  history: ChecklistHistoryRow[];
};

export type AttentionItem = {
  id?: number;
  checklistId: string;
  message: string;
  at: number;
};

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("snapshots", { keyPath: "checklistId" });
      const ops = db.createObjectStore("ops", { keyPath: "seq", autoIncrement: true });
      ops.createIndex("checklistId", "checklistId");
      db.createObjectStore("photos");
      const att = db.createObjectStore("attention", { keyPath: "id", autoIncrement: true });
      att.createIndex("checklistId", "checklistId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createStore(idb: IDBFactory = indexedDB) {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () => (dbp ??= open(idb));
  const tx = async (names: string[], mode: IDBTransactionMode) => (await db()).transaction(names, mode);

  return {
    async saveSnapshot(s: Snapshot) {
      const t = await tx(["snapshots"], "readwrite");
      await wrap(t.objectStore("snapshots").put(s));
    },
    async getSnapshot(checklistId: string): Promise<Snapshot | null> {
      const t = await tx(["snapshots"], "readonly");
      return ((await wrap(t.objectStore("snapshots").get(checklistId))) as Snapshot | undefined) ?? null;
    },
    async addOp(op: NewOp, photo?: Blob | null): Promise<QueuedOp> {
      const t = await tx(["ops", "photos"], "readwrite");
      let photoKey: string | null = null;
      if (photo) {
        photoKey = op.clientId;
        await wrap(t.objectStore("photos").put(photo, photoKey));
      }
      const full = { ...op, attempts: 0, photoKey } as Omit<QueuedOp, "seq">;
      const seq = (await wrap(t.objectStore("ops").add(full))) as number;
      return { ...full, seq } as QueuedOp;
    },
    async listOps(checklistId: string): Promise<QueuedOp[]> {
      const t = await tx(["ops"], "readonly");
      const all = (await wrap(t.objectStore("ops").index("checklistId").getAll(checklistId))) as QueuedOp[];
      return all.sort((a, b) => a.seq - b.seq);
    },
    async removeOps(seqs: number[]) {
      const t = await tx(["ops"], "readwrite");
      await Promise.all(seqs.map((s) => wrap(t.objectStore("ops").delete(s))));
    },
    async removeOp(seq: number) {
      const t = await tx(["ops", "photos"], "readwrite");
      const op = (await wrap(t.objectStore("ops").get(seq))) as QueuedOp | undefined;
      await wrap(t.objectStore("ops").delete(seq));
      if (op?.photoKey) await wrap(t.objectStore("photos").delete(op.photoKey));
    },
    async bumpAttempts(seq: number) {
      const t = await tx(["ops"], "readwrite");
      const op = (await wrap(t.objectStore("ops").get(seq))) as QueuedOp | undefined;
      if (op) await wrap(t.objectStore("ops").put({ ...op, attempts: op.attempts + 1 }));
    },
    async getPhoto(key: string): Promise<Blob | null> {
      const t = await tx(["photos"], "readonly");
      return ((await wrap(t.objectStore("photos").get(key))) as Blob | undefined) ?? null;
    },
    async addAttention(a: Omit<AttentionItem, "id">) {
      const t = await tx(["attention"], "readwrite");
      await wrap(t.objectStore("attention").add(a));
    },
    async listAttention(checklistId: string): Promise<AttentionItem[]> {
      const t = await tx(["attention"], "readonly");
      return (await wrap(t.objectStore("attention").index("checklistId").getAll(checklistId))) as AttentionItem[];
    },
    async dismissAttention(id: number) {
      const t = await tx(["attention"], "readwrite");
      await wrap(t.objectStore("attention").delete(id));
    },
    /** How many changes are still waiting to sync, across every checklist on this device. */
    async countAllOps(): Promise<number> {
      const t = await tx(["ops"], "readonly");
      return (await wrap(t.objectStore("ops").count())) as number;
    },
    /** Sign-out on a shared device: nothing stays behind. */
    async purge() {
      const t = await tx(["snapshots", "ops", "photos", "attention"], "readwrite");
      await Promise.all(["snapshots", "ops", "photos", "attention"].map((n) => wrap(t.objectStore(n).clear())));
    },
  };
}

export type OfflineStore = ReturnType<typeof createStore>;
