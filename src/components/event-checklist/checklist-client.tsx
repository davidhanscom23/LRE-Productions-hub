"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isoToDatetimeLocalEastern } from "@/lib/av-erp/datetime";
import type { ChecklistProject } from "@/lib/event-checklist/data";
import {
  checkedQty,
  countsForPass,
  itemState,
  outVerb,
  passTotals,
  returnVerb,
} from "@/lib/event-checklist/progress";
import {
  SOURCE_LABELS,
  type Checklist,
  type ChecklistFlag,
  type ChecklistHistoryRow,
  type ChecklistItem,
  type ChecklistPass,
  type ChecklistSource,
} from "@/lib/event-checklist/types";
import { downscalePhoto } from "@/lib/event-checklist/offline/photo";
import { SyncStatus } from "@/components/event-checklist/sync-status";
import { useOfflineChecklist } from "@/components/event-checklist/use-offline-checklist";
import { EventInfoPanel } from "@/components/event-checklist/event-info-panel";
import type { EventInfo } from "@/lib/event-checklist/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";
const btnClass =
  "rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50";

const WHEN_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function when(iso: string | null) {
  if (!iso) return "Not set";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Not set" : WHEN_FMT.format(d);
}

function qtyLabel(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "");
}

function ProgressBar({ label, pass, items }: { label: string; pass: ChecklistPass; items: ChecklistItem[] }) {
  const t = passTotals(items, pass);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <p className={`text-lg font-bold ${t.complete ? "text-emerald-600" : ""}`}>{t.percent}%</p>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-valuenow={t.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress`}
      >
        <div
          className={`h-full rounded-full transition-all ${t.complete ? "bg-emerald-500" : "bg-[var(--brand)]"}`}
          style={{ width: `${t.percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {t.complete
          ? "Everything is checked."
          : `${qtyLabel(t.done)} of ${qtyLabel(t.needed)} checked · ${t.remainingItems} item${t.remainingItems === 1 ? "" : "s"} still needed`}
      </p>
    </div>
  );
}

type Props = {
  project: ChecklistProject;
  checklist: Checklist;
  items: ChecklistItem[];
  history: ChecklistHistoryRow[];
  estimateRef: string | null;
  info: EventInfo | null;
  venueOptions: { id: string; name: string }[];
  productOptions: { id: string; name: string; kind: string }[];
  loadedAt: number;
};

export function ChecklistClient({
  project,
  checklist: serverChecklist,
  items: serverItems,
  history: serverHistory,
  estimateRef,
  info,
  venueOptions,
  productOptions,
  loadedAt,
}: Props) {
  const offline = useOfflineChecklist({
    checklist: serverChecklist,
    items: serverItems,
    history: serverHistory,
    loadedAt,
  });
  const { items, history, checklist, pendingItemIds, enqueue } = offline;
  const [pass, setPass] = useState<ChecklistPass>("out");
  const [onlyNeeded, setOnlyNeeded] = useState(false);
  const [flagFor, setFlagFor] = useState<string | null>(null);
  const [flag, setFlag] = useState<ChecklistFlag>("damaged");
  const [flagNote, setFlagNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [depart, setDepart] = useState(isoToDatetimeLocalEastern(checklist.depart_at));
  const [back, setBack] = useState(isoToDatetimeLocalEastern(checklist.return_at));
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newSource, setNewSource] = useState<ChecklistSource>("in_house");

  const active = useMemo(() => items.filter((i) => !i.removed_at), [items]);
  const removed = useMemo(() => items.filter((i) => i.removed_at && (i.qty_out > 0 || i.qty_back > 0)), [items]);
  const visible = active.filter((i) => countsForPass(i, pass)).filter((i) => !onlyNeeded || itemState(i, pass) !== "done");

  function check(item: ChecklistItem, delta: number) {
    void enqueue("check", { itemId: item.id, pass, qty: delta });
  }

  async function submitFlag(item: ChecklistItem) {
    const blob = photo ? await downscalePhoto(photo) : null;
    const ok = await enqueue(
      "check",
      { itemId: item.id, pass, qty: 0, flag, note: flagNote.trim().slice(0, 500) },
      blob,
    );
    if (ok) {
      setFlagFor(null);
      setFlagNote("");
      setPhoto(null);
    }
  }

  const passLabel = pass === "out" ? "Leaving the warehouse" : "Returning to the warehouse";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <Link href="/pipeline" className="text-xs text-[var(--muted)] hover:underline">
          ← Events
        </Link>
        <h1 className="mt-1 text-xl font-bold">{project.name}</h1>
        <p className="text-sm text-[var(--muted)]">
          {project.project_date ?? "No date"}
          {project.location ? ` · ${project.location}` : ""}
          {estimateRef ? ` · Estimate ${estimateRef}` : " · No estimate linked"}
        </p>
      </div>

      <EventInfoPanel
        info={info}
        projectId={project.id}
        fallbackLocation={project.location}
        venueOptions={venueOptions}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ProgressBar label="Out of the warehouse" pass="out" items={items} />
        <ProgressBar label="Back in the warehouse" pass="back" items={items} />
      </div>

      <SyncStatus
        online={offline.online}
        syncing={offline.syncing}
        pendingCount={offline.pendingCount}
        lastSyncedAt={offline.lastSyncedAt}
        attention={offline.attention}
        onSync={() => void offline.syncNow()}
        onDismiss={(id) => void offline.dismissAttention(id)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(["out", "back"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPass(p)}
            className={`${btnClass} ${pass === p ? "bg-[var(--brand)] text-white" : ""}`}
          >
            {p === "out" ? "Check out" : "Check back in"}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyNeeded} onChange={(e) => setOnlyNeeded(e.target.checked)} />
          Only what&apos;s still needed
        </label>
      </div>

      <p className="text-sm font-medium">{passLabel}</p>

      {active.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          No gear on this list yet. Link an AV estimate to this event, or add items below.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
          Nothing left to check for this step.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const state = itemState(item, pass);
            const got = checkedQty(item, pass);
            return (
              <li key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                   
                    onClick={() => check(item, state === "done" ? -item.qty_needed : item.qty_needed)}
                    aria-label={state === "done" ? `Uncheck ${item.name}` : `Check all of ${item.name}`}
                    className={`mt-0.5 h-8 w-8 shrink-0 rounded-md border text-sm font-bold ${
                      state === "done"
                        ? "border-emerald-600 bg-emerald-500 text-white"
                        : state === "partial"
                          ? "border-amber-500 bg-amber-100 text-amber-900"
                          : "border-[var(--border)]"
                    }`}
                  >
                    {state === "done" ? "✓" : state === "partial" ? "–" : ""}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">
                      {item.name}
                      {pendingItemIds.has(item.id) ? (
                        <span className="ml-2 rounded-full border border-amber-400 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-800 dark:text-amber-200">
                          Waiting to sync
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {SOURCE_LABELS[item.source]} ·{" "}
                      {pass === "out" ? outVerb(item.source) : returnVerb(item.source)} · {qtyLabel(got)} of{" "}
                      {qtyLabel(item.qty_needed)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={got <= 0} onClick={() => check(item, -1)} className={btnClass} aria-label="One less">
                      −
                    </button>
                    <button type="button" disabled={got >= item.qty_needed} onClick={() => check(item, 1)} className={btnClass} aria-label="One more">
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-11 text-xs">
                  <select
                    value={item.source}
                   
                    onChange={(e) => void enqueue("setSource", { itemId: item.id, source: e.target.value as ChecklistSource })}
                    className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                    aria-label="Where this gear comes from"
                  >
                    {(Object.keys(SOURCE_LABELS) as ChecklistSource[]).map((s) => (
                      <option key={s} value={s}>
                        {SOURCE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setFlagFor(flagFor === item.id ? null : item.id)} className="font-medium text-[var(--brand)] hover:underline">
                    Damaged or missing
                  </button>
                  {item.origin === "manual" ? (
                    <button type="button" onClick={() => void enqueue("removeItem", { itemId: item.id })} className="text-[var(--muted)] hover:underline">
                      Remove
                    </button>
                  ) : null}
                </div>
                {flagFor === item.id ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="flex gap-2">
                      {(["damaged", "missing"] as const).map((f) => (
                        <button key={f} type="button" onClick={() => setFlag(f)} className={`${btnClass} ${flag === f ? "bg-[var(--brand)] text-white" : ""}`}>
                          {f === "damaged" ? "Damaged" : "Missing"}
                        </button>
                      ))}
                    </div>
                    <input value={flagNote} onChange={(e) => setFlagNote(e.target.value)} placeholder="What happened?" maxLength={500} className={fieldClass} />
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="text-xs" />
                    <button type="button" onClick={() => void submitFlag(item)} className={`${btnClass} bg-[var(--brand)] text-white`}>
                      Save flag
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {removed.length > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          {removed.length} checked item{removed.length === 1 ? " was" : "s were"} removed from the estimate:{" "}
          {removed.map((r) => r.name).join(", ")}. Their checks stay in the history.
        </p>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add an item</h2>
          <button type="button" onClick={() => setAdding((a) => !a)} className="text-xs font-medium text-[var(--brand)] hover:underline">
            {adding ? "Cancel" : "Add"}
          </button>
        </div>
        {adding ? (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_5rem_9rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const picked = productOptions.find(
                (p) => p.name.trim().toLowerCase() === newName.trim().toLowerCase(),
              );
              const qty = Math.round((Number(newQty) || 0) * 100) / 100;
              if (!newName.trim() || qty <= 0) return;
              void enqueue("addItem", {
                id: crypto.randomUUID(),
                checklistId: checklist.id,
                name: newName.trim().slice(0, 200),
                qty,
                source: newSource,
                productId: picked?.id ?? null,
                returns: picked ? !["sale", "consumable"].includes(picked.kind) : true,
              });
              setNewName("");
              setNewQty("1");
              setAdding(false);
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Search inventory or type an item"
              list="checklist-inventory"
              className={fieldClass}
              required
            />
            <datalist id="checklist-inventory">
              {productOptions.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <input value={newQty} onChange={(e) => setNewQty(e.target.value)} inputMode="decimal" aria-label="Quantity" className={fieldClass} />
            <select value={newSource} onChange={(e) => setNewSource(e.target.value as ChecklistSource)} className={fieldClass}>
              {(Object.keys(SOURCE_LABELS) as ChecklistSource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="submit" className={`${btnClass} bg-[var(--brand)] text-white`}>
              Add
            </button>
          </form>
        ) : (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Contract items come from the linked estimate and update by themselves. Add anything extra here, picking from the inventory list when it is there.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">Schedule</h2>
        <p className="text-xs text-[var(--muted)]">
          Leaves {when(checklist.depart_at)} · due back {when(checklist.return_at)} (Eastern). Reminders follow these times.
        </p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void enqueue("schedule", { checklistId: checklist.id, departAt: depart, returnAt: back });
          }}
        >
          <label className="text-xs">
            <span className="mb-1 block text-[var(--muted)]">Leaves the warehouse</span>
            <input type="datetime-local" value={depart} onChange={(e) => setDepart(e.target.value)} className={fieldClass} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-[var(--muted)]">Due back</span>
            <input type="datetime-local" value={back} onChange={(e) => setBack(e.target.value)} className={fieldClass} />
          </label>
          <button type="submit" className={`${btnClass} self-end`}>
            Save times
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">History</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Shows the last 90 days. Older history is saved in the yearly backup.
        </p>
        {history.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--muted)]">No checks yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <p>
                  <span className="font-medium">{h.checked_by_name}</span>{" "}
                  {h.flag !== "none"
                    ? `marked ${h.item_name} ${h.flag}`
                    : `${h.qty > 0 ? "checked" : "unchecked"} ${qtyLabel(Math.abs(h.qty))} × ${h.item_name} (${h.pass === "out" ? "out" : "back"})`}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {h.id.startsWith("pending-") ? "Not synced yet · " : ""}
                  {when(h.checked_at)}
                  {h.note ? ` · ${h.note}` : ""}
                  {h.photo_path ? " · photo attached" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
