"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  checkGearBackAction,
  checkGearOutAction,
} from "@/app/(app)/rentals/warehouse/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type {
  WarehouseCheckoutRow,
  WarehouseStillOutRow,
} from "@/lib/av-erp/warehouse-data";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

type WarehouseTab = "all" | "out" | "overdue" | "checkout";

type Props = {
  stillOut: WarehouseStillOutRow[];
  checkoutReady: WarehouseCheckoutRow[];
  overdueCount: number;
  stillOutCount: number;
  initialTab?: WarehouseTab;
};

export function WarehouseClient({
  stillOut,
  checkoutReady,
  overdueCount,
  stillOutCount,
  initialTab = "all",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<WarehouseTab>(initialTab);
  const [scan, setScan] = useState("");

  const scanQ = scan.trim().toLowerCase();
  const visibleStillOut = (
    tab === "overdue" ? stillOut.filter((r) => r.overdue) : stillOut
  ).filter((r) => {
    if (!scanQ) return true;
    return (
      r.productName.toLowerCase().includes(scanQ) ||
      r.productCode.toLowerCase().includes(scanQ) ||
      r.reference.toLowerCase().includes(scanQ)
    );
  });
  const visibleCheckout = checkoutReady.filter((r) => {
    if (!scanQ) return true;
    return (
      r.productName.toLowerCase().includes(scanQ) ||
      r.productCode.toLowerCase().includes(scanQ) ||
      r.reference.toLowerCase().includes(scanQ)
    );
  });
  const showStillOut = tab === "all" || tab === "out" || tab === "overdue";
  const showCheckout = tab === "all" || tab === "checkout";

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    okMsg: string,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(okMsg);
      router.refresh();
    });
  }

  function onOut(e: FormEvent<HTMLFormElement>, row: WarehouseCheckoutRow) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("opportunity_id", row.opportunityId);
    fd.set("product_id", row.productId);
    run(() => checkGearOutAction(fd), "Gear checked out.");
  }

  function onBack(e: FormEvent<HTMLFormElement>, row: WarehouseStillOutRow) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("opportunity_id", row.opportunityId);
    fd.set("product_id", row.productId);
    run(() => checkGearBackAction(fd), "Gear checked back in.");
  }

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Warehouse
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Check gear out to reserved jobs and check it back in. Still-out and
            overdue are Hub-owned.
          </p>
        </div>
        <Link
          href="/rentals/stock"
          className="text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          Stock →
        </Link>
      </div>

      <label className="mb-3 block max-w-md text-sm">
        <span className="mb-1 block text-[var(--muted)]">
          Scan / filter (product code or name)
        </span>
        <input
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder="Scan barcode or type code…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          autoComplete="off"
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["all", "All"],
            ["out", "Still out"],
            ["overdue", "Overdue"],
            ["checkout", "Checkout ready"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              router.replace(
                id === "all" ? "/rentals/warehouse" : `/rentals/warehouse?tab=${id}`,
              );
            }}
            className={
              tab === id
                ? "rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setTab("out");
            router.replace("/rentals/warehouse?tab=out");
          }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:bg-[var(--surface-hover)]"
        >
          <p className="text-2xl font-semibold">{stillOutCount}</p>
          <p className="text-xs text-[var(--muted)]">Lines still out</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("overdue");
            router.replace("/rentals/warehouse?tab=overdue");
          }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:bg-[var(--surface-hover)]"
        >
          <p
            className={`text-2xl font-semibold ${overdueCount > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}
          >
            {overdueCount}
          </p>
          <p className="text-xs text-[var(--muted)]">Overdue returns</p>
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {message}
        </p>
      ) : null}

      {showStillOut ? (
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold">
          {tab === "overdue" ? "Overdue returns" : "Still out"}
        </h2>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {visibleStillOut.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              {tab === "overdue"
                ? "No overdue returns."
                : "Nothing checked out right now."}
            </li>
          ) : (
            visibleStillOut.map((row) => (
              <li
                key={`${row.opportunityId}-${row.productId}`}
                className="px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <Link
                        href={`/rentals/quotes/${row.opportunityId}`}
                        className="hover:underline"
                      >
                        {row.reference}
                      </Link>{" "}
                      <span className="font-normal text-[var(--muted)]">
                        · {row.productName}
                      </span>
                      {row.overdue ? (
                        <span className="ml-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          Overdue
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {row.subject} · {row.stillOut} out · back by{" "}
                      {formatWhen(row.gearEndsAt)}
                    </p>
                  </div>
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => onBack(e, row)}
                  >
                    <label className="block text-xs">
                      <span className="mb-1 block text-[var(--muted)]">Qty</span>
                      <input
                        name="qty"
                        type="number"
                        min={0.01}
                        step={0.01}
                        defaultValue={row.stillOut}
                        className={`${fieldClass} w-20`}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={pending}
                      className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Check back
                    </button>
                  </form>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      ) : null}

      {showCheckout ? (
      <section>
        <h2 className="mb-2 text-sm font-semibold">Ready to check out</h2>
        <p className="mb-2 text-xs text-[var(--muted)]">
          From Confirm and reserve holds that are not fully checked out yet.
        </p>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {checkoutReady.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No reserved gear waiting to leave. Confirm and reserve on an estimate
              first — or load a sample shop from Overview.
            </li>
          ) : (
            visibleCheckout.map((row) => (
              <li
                key={`${row.opportunityId}-${row.productId}`}
                className="px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <Link
                        href={`/rentals/quotes/${row.opportunityId}`}
                        className="hover:underline"
                      >
                        {row.reference}
                      </Link>{" "}
                      <span className="font-normal text-[var(--muted)]">
                        · {row.productName}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {row.subject} · held {row.heldQty}
                      {row.stillOut > 0 ? ` · already out ${row.stillOut}` : ""}{" "}
                      · remaining {row.remaining} · out{" "}
                      {formatWhen(row.gearStartsAt)}
                    </p>
                  </div>
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => onOut(e, row)}
                  >
                    <label className="block text-xs">
                      <span className="mb-1 block text-[var(--muted)]">Qty</span>
                      <input
                        name="qty"
                        type="number"
                        min={0.01}
                        step={0.01}
                        defaultValue={row.remaining}
                        className={`${fieldClass} w-20`}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={pending}
                      className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Check out
                    </button>
                  </form>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      ) : null}
    </AvErpPage>
  );
}
