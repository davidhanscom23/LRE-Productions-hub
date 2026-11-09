"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addChangeOrderLineAction,
  createChangeOrderAction,
  deleteChangeOrderLineAction,
  enableChangeOrderShareAction,
  voidChangeOrderAction,
} from "@/app/(app)/rentals/quotes/actions";
import type {
  AvChangeOrder,
  AvChangeOrderApplyMode,
  AvChangeOrderLine,
  AvOpportunityLine,
} from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export type QuoteLineOption = Pick<
  AvOpportunityLine,
  "id" | "description" | "qty" | "unit_price"
>;

type Props = {
  opportunityId: string;
  changeOrders: AvChangeOrder[];
  changeOrderLinesByCoId?: Record<string, AvChangeOrderLine[]>;
  quoteLines?: QuoteLineOption[];
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function ChangeOrderLineForm({
  changeOrderId,
  quoteLines,
  pending,
  run,
  onError,
}: {
  changeOrderId: string;
  quoteLines: QuoteLineOption[];
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
  onError: (msg: string) => void;
}) {
  const [applyMode, setApplyMode] = useState<AvChangeOrderApplyMode>("add");
  const [sourceLineId, setSourceLineId] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");

  const selected = useMemo(
    () => quoteLines.find((l) => l.id === sourceLineId) ?? null,
    [quoteLines, sourceLineId],
  );

  function onSourceChange(id: string) {
    setSourceLineId(id);
    const line = quoteLines.find((l) => l.id === id);
    if (!line) return;
    setDescription(line.description || "");
    setQty(String(line.qty));
    setUnitPrice(String(line.unit_price));
  }

  function onModeChange(mode: AvChangeOrderApplyMode) {
    setApplyMode(mode);
    if (mode === "add") {
      setSourceLineId("");
      setDescription("");
      setQty("1");
      setUnitPrice("0");
      return;
    }
    if (selected) {
      setDescription(selected.description || "");
      setQty(mode === "remove" ? "0" : String(selected.qty));
      setUnitPrice(mode === "remove" ? "0" : String(selected.unit_price));
    }
  }

  return (
    <form
      className="grid gap-2 sm:grid-cols-12 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const result = await addChangeOrderLineAction({
            changeOrderId,
            description,
            qty: Number(qty) || 0,
            unitPrice: Number(unitPrice) || 0,
            applyMode,
            sourceLineId: applyMode === "add" ? null : sourceLineId || null,
          });
          if (!result.ok) {
            onError(result.error);
            return;
          }
          setApplyMode("add");
          setSourceLineId("");
          setDescription("");
          setQty("1");
          setUnitPrice("0");
        });
      }}
    >
      <label className="block text-xs sm:col-span-3">
        <span className="mb-1 block text-[var(--muted)]">Action</span>
        <select
          value={applyMode}
          onChange={(e) =>
            onModeChange(e.target.value as AvChangeOrderApplyMode)
          }
          className={fieldClass}
        >
          <option value="add">Add new line</option>
          <option value="adjust_qty">Adjust qty</option>
          <option value="remove">Remove line</option>
        </select>
      </label>

      {applyMode !== "add" ? (
        <label className="block text-xs sm:col-span-9">
          <span className="mb-1 block text-[var(--muted)]">Estimate line</span>
          <select
            value={sourceLineId}
            onChange={(e) => onSourceChange(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Select a line…</option>
            {quoteLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.description || "(untitled)"} · qty {l.qty} @{" "}
                {money(l.unit_price)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label
        className={`block text-xs ${applyMode === "add" ? "sm:col-span-5" : "sm:col-span-5"}`}
      >
        <span className="mb-1 block text-[var(--muted)]">Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required={applyMode === "add"}
          disabled={applyMode === "remove"}
          className={fieldClass}
          placeholder="Description"
        />
      </label>
      <label className="block text-xs sm:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">
          {applyMode === "adjust_qty" ? "New qty" : "Qty"}
        </span>
        <input
          type="number"
          step="0.01"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          disabled={applyMode === "remove"}
          className={fieldClass}
        />
      </label>
      <label className="block text-xs sm:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">Unit $</span>
        <input
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          disabled={applyMode === "remove"}
          className={fieldClass}
        />
      </label>
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={pending || (applyMode !== "add" && !sourceLineId)}
          className="h-10 w-full rounded-lg border border-[var(--border)] text-xs font-semibold disabled:opacity-50"
        >
          {applyMode === "add"
            ? "Add line"
            : applyMode === "adjust_qty"
              ? "Add adjust"
              : "Add remove"}
        </button>
      </div>
    </form>
  );
}

export function QuoteChangeOrdersPanel({
  opportunityId,
  changeOrders,
  changeOrderLinesByCoId = {},
  quoteLines = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [sharePaths, setSharePaths] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const co of changeOrders) {
      if (co.share_enabled && co.share_token) {
        map[co.id] = `/change-order/${co.share_token}`;
      }
    }
    return map;
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createChangeOrderAction({
        opportunityId,
        subject,
        summary,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubject("");
      setSummary("");
      setMessage(`Created ${result.number}. Add line items below, then share.`);
      router.refresh();
    });
  }

  const chargeableLines = useMemo(
    () =>
      quoteLines.filter(
        (l) => (l.description || "").trim().length > 0 || l.qty > 0,
      ),
    [quoteLines],
  );

  return (
    <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold">Change orders</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Add, adjust qty, or remove estimate lines; share for customer e-sign. On
        accept, lines sync into this estimate and a stamped PDF is emailed.
      </p>

      <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={fieldClass}
            required
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Summary</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create change order
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      {changeOrders.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {changeOrders.map((co) => {
            const lines = changeOrderLinesByCoId[co.id] ?? [];
            const editable =
              co.status !== "void" &&
              co.status !== "accepted" &&
              co.status !== "declined";
            return (
              <li key={co.id} className="space-y-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {co.number}
                      {co.subject ? ` — ${co.subject}` : ""}
                    </p>
                    <p className="text-[var(--muted)]">
                      {co.status}
                      {` · ${co.amount_delta > 0 ? "+" : ""}${money(co.amount_delta)}`}
                      {co.status === "accepted" && co.signer_name
                        ? ` · signed by ${co.signer_name}`
                        : ""}
                    </p>
                    {sharePaths[co.id] ? (
                      <p className="mt-1 break-all text-xs text-[var(--muted)]">
                        {sharePaths[co.id]}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editable ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await enableChangeOrderShareAction(
                              co.id,
                            );
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            setSharePaths((prev) => ({
                              ...prev,
                              [co.id]: result.path,
                            }));
                            setMessage(`Share link ready for ${co.number}.`);
                            router.refresh();
                          });
                        }}
                        className="h-8 rounded-lg border border-[var(--border)] px-3 text-xs font-medium disabled:opacity-50"
                      >
                        Share for e-sign
                      </button>
                    ) : null}
                    {co.status !== "void" && co.status !== "accepted" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await voidChangeOrderAction(co.id);
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            router.refresh();
                          });
                        }}
                        className="h-8 rounded-lg px-2 text-xs text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        Void
                      </button>
                    ) : null}
                  </div>
                </div>

                {lines.length > 0 ? (
                  <ul className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
                    {lines.map((l) => (
                      <li
                        key={l.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-1"
                      >
                        <span>
                          [{l.apply_mode}] {l.description} · qty {l.qty} @{" "}
                          {money(l.unit_price)}
                        </span>
                        {editable ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                const result = await deleteChangeOrderLineAction(
                                  l.id,
                                );
                                if (!result.ok) {
                                  setError(result.error);
                                  return;
                                }
                                router.refresh();
                              });
                            }}
                            className="text-[var(--muted)] underline-offset-2 hover:underline"
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No lines yet.</p>
                )}

                {editable ? (
                  <ChangeOrderLineForm
                    changeOrderId={co.id}
                    quoteLines={chargeableLines}
                    pending={pending}
                    onError={(msg) => setError(msg)}
                    run={(fn) => {
                      setError(null);
                      startTransition(async () => {
                        await fn();
                        router.refresh();
                      });
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
