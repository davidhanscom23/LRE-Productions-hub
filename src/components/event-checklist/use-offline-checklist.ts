"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Checklist, ChecklistHistoryRow, ChecklistItem } from "@/lib/event-checklist/types";
import { applyPending, pendingHistory } from "@/lib/event-checklist/offline/optimistic";
import {
  backoffMs,
  describeOp,
  supersededSeqs,
  type OpKind,
  type OpPayloads,
  type QueuedOp,
} from "@/lib/event-checklist/offline/ops";
import { createStore, type AttentionItem, type OfflineStore, type Snapshot } from "@/lib/event-checklist/offline/store";
import { runSync } from "@/lib/event-checklist/offline/sync";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

type Args = {
  checklist: Checklist;
  items: ChecklistItem[];
  history: ChecklistHistoryRow[];
  loadedAt: number;
};

export function useOfflineChecklist({ checklist, items, history, loadedAt }: Args) {
  const router = useRouter();
  const checklistId = checklist.id;
  const storeRef = useRef<OfflineStore | null>(null);
  const getStore = useCallback(() => {
    if (!storeRef.current && typeof indexedDB !== "undefined") storeRef.current = createStore();
    return storeRef.current;
  }, []);

  const [ops, setOps] = useState<QueuedOp[]>([]);
  const [done, setDone] = useState<QueuedOp[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [reachable, setReachable] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const syncRef = useRef<() => Promise<void>>(async () => {});
  const syncingRef = useRef(false);
  const failsRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const loadedAtRef = useRef(loadedAt);
  const doneStampRef = useRef<number | null>(null);
  const namesRef = useRef(new Map<string, string>());

  useEffect(() => {
    loadedAtRef.current = loadedAt;
    namesRef.current = new Map(items.map((i) => [i.id, i.name]));
  });

  const reload = useCallback(async () => {
    const store = getStore();
    if (!store) return;
    const [o, a] = await Promise.all([store.listOps(checklistId), store.listAttention(checklistId)]);
    setOps(o);
    setAttention(a);
  }, [checklistId, getStore]);

  // First load: queue, failures and the saved copy of the board.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setBrowserOnline(navigator.onLine);
      void reload();
      void getStore()
        ?.getSnapshot(checklistId)
        .then((s) => setSnap(s))
        .catch(() => {});
      void navigator.storage?.persist?.().catch(() => {});
    }, 0);
    return () => window.clearTimeout(t);
  }, [checklistId, getStore, reload]);

  // Keep a copy of every fresh board so the page can open with no signal.
  useEffect(() => {
    const store = getStore();
    if (!store) return;
    // Never replace a newer copy on the device with an older cached page.
    void store
      .getSnapshot(checklistId)
      .then((existing) => {
        if (existing && existing.loadedAt >= loadedAt) return;
        return store.saveSnapshot({ checklistId, loadedAt, checklist, items, history });
      })
      .catch(() => {});
    // The server data has caught up with what was just synced: stop layering it on top.
    if (doneStampRef.current !== null && doneStampRef.current !== loadedAt) {
      doneStampRef.current = null;
      const t = window.setTimeout(() => setDone([]), 0);
      return () => window.clearTimeout(t);
    }
  }, [checklistId, loadedAt, checklist, items, history, getStore]);

  const syncNow = useCallback(async () => {
    const store = getStore();
    if (!store || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const finished: QueuedOp[] = [];
    try {
      const run = () =>
        runSync({
          list: () => store.listOps(checklistId),
          remove: async (seq) => {
            const op = (await store.listOps(checklistId)).find((o) => o.seq === seq);
            if (op) finished.push(op);
            await store.removeOp(seq);
          },
          bumpAttempts: (seq) => store.bumpAttempts(seq),
          fail: async (op, error) => {
            const label = describeOp(op, namesRef.current.get((op.payload as { itemId?: string }).itemId ?? ""));
            await store.addAttention({ checklistId, message: `${label} could not be saved: ${error}`, at: Date.now() });
          },
          uploadPhoto: async (op) => {
            const blob = op.photoKey ? await store.getPhoto(op.photoKey) : null;
            if (!blob) return null;
            const path = `${checklistId}/${op.clientId}.jpg`;
            const { error } = await createBrowserSupabase()
              .storage.from("checklist-photos")
              .upload(path, blob, { cacheControl: "31536000", upsert: false, contentType: "image/jpeg" });
            if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
            return path;
          },
          send: async (batch) => {
            const ctrl = new AbortController();
            const timer = window.setTimeout(() => ctrl.abort(), 15000);
            try {
              const res = await fetch("/api/event-checklist/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                signal: ctrl.signal,
                body: JSON.stringify({
                  ops: batch.map((o) => ({ seq: o.seq, kind: o.kind, clientId: o.clientId, payload: o.payload })),
                }),
              });
              if (res.redirected || res.status === 401) {
                return [{ seq: batch[0].seq, status: "auth" as const, error: "Sign in to sync." }];
              }
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const json = (await res.json()) as { results: Awaited<ReturnType<Parameters<typeof runSync>[0]["send"]>> };
              return json.results;
            } finally {
              window.clearTimeout(timer);
            }
          },
        });
      const outcome = navigator.locks ? await navigator.locks.request(`checklist-sync-${checklistId}`, run) : await run();

      if (finished.length > 0) {
        doneStampRef.current = loadedAtRef.current;
        setDone((d) => [...d, ...finished]);
      }
      if (outcome.state === "offline" || outcome.state === "retry") {
        setReachable(outcome.state !== "offline");
        failsRef.current += 1;
        timerRef.current = window.setTimeout(() => void syncRef.current(), backoffMs(failsRef.current));
      } else {
        setReachable(true);
        failsRef.current = 0;
        if (outcome.state === "synced") setLastSyncedAt(Date.now());
        if (outcome.state === "synced" && outcome.sent + outcome.failed > 0 && navigator.onLine) router.refresh();
      }
    } catch {
      setReachable(false);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await reload();
    }
  }, [checklistId, getStore, reload, router]);

  useEffect(() => {
    syncRef.current = syncNow;
  }, [syncNow]);

  // Sync when signal returns, when the app comes back to the front, and once at the start.
  useEffect(() => {
    const online = () => {
      setBrowserOnline(true);
      void syncNow();
    };
    const offline = () => setBrowserOnline(false);
    const visible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    const t = window.setTimeout(() => void syncNow(), 800);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
      window.clearTimeout(t);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [syncNow]);

  const enqueue = useCallback(
    async <K extends OpKind>(kind: K, payload: OpPayloads[K], photo?: Blob | null) => {
      const store = getStore();
      if (!store) return false;
      const existing = await store.listOps(checklistId);
      const candidate = { kind, payload, checklistId } as Pick<QueuedOp, "kind" | "payload" | "checklistId">;
      const old = supersededSeqs(existing, candidate);
      if (old.length) await store.removeOps(old);
      await store.addOp({ checklistId, kind, payload, clientId: crypto.randomUUID(), createdAt: Date.now() }, photo);
      await reload();
      void syncNow();
      return true;
    },
    [checklistId, getStore, reload, syncNow],
  );

  const dismissAttention = useCallback(
    async (id: number) => {
      await getStore()?.dismissAttention(id);
      await reload();
    },
    [getStore, reload],
  );

  // Show the newer of: this page's data, or the copy saved on the device.
  const useSnap = snap && snap.loadedAt > loadedAt;
  const baseItems = useSnap ? snap.items : items;
  const baseHistory = useSnap ? snap.history : history;
  const baseChecklist = useSnap ? snap.checklist : checklist;

  const layered = useMemo(() => [...done, ...ops], [done, ops]);
  const viewItems = useMemo(() => applyPending(baseItems, layered), [baseItems, layered]);
  const viewHistory = useMemo(
    () => [...pendingHistory(viewItems, ops, "You"), ...baseHistory],
    [viewItems, ops, baseHistory],
  );
  const pendingItemIds = useMemo(
    () => new Set(ops.map((o) => (o.payload as { itemId?: string; id?: string }).itemId ?? (o.payload as { id?: string }).id ?? "")),
    [ops],
  );

  return {
    items: viewItems,
    history: viewHistory,
    checklist: baseChecklist,
    pendingCount: ops.length,
    pendingItemIds,
    attention,
    dismissAttention,
    online: browserOnline && reachable,
    syncing,
    lastSyncedAt,
    enqueue,
    syncNow,
  };
}
