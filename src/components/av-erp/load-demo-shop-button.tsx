"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearDemoShopAction,
  loadDemoShopAction,
} from "@/app/(app)/rentals/demo-shop-actions";

type Props = {
  /** Strong CTA when catalog + quotes look empty. */
  emptyShop: boolean;
  /** Sample fixtures are present — offer clear instead of load. */
  demoLoaded: boolean;
};

export function LoadDemoShopButton({ emptyShop, demoLoaded }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<
      { ok: true; message: string } | { ok: false; error: string }
    >,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  if (demoLoaded) {
    return (
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-sm text-[var(--foreground)]">
          Sample shop is loaded. Open{" "}
          <Link
            href="/rentals/quotes"
            className="text-[var(--brand)] hover:underline"
          >
            Estimates
          </Link>
          , then{" "}
          <Link
            href="/rentals/warehouse"
            className="text-[var(--brand)] hover:underline"
          >
            Warehouse
          </Link>{" "}
          (checkout ready), then draft an invoice from a quotation — or clear
          the sample rows when you are done practicing.
        </p>
        <button
          type="button"
          disabled={pending}
          data-testid="av-clear-sample-shop"
          className="mt-2 h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-red-700 disabled:opacity-50 dark:text-red-300"
          onClick={() => {
            if (
              !window.confirm(
                "Remove the sample shop (demo estimates, catalog, customers, venues, and related invoices)? Real rows you created stay.",
              )
            ) {
              return;
            }
            run(() => clearDemoShopAction());
          }}
        >
          {pending ? "Clearing…" : "Clear sample shop"}
        </button>
        {message ? (
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={
        emptyShop
          ? "mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          : "mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-3"
      }
    >
      <p className="text-sm text-[var(--foreground)]">
        {emptyShop
          ? "Shop looks empty. Load a sample catalog, customers, venues, a draft estimate, and a reserved quotation so you can walk Estimates → Warehouse → Invoices without building rows by hand."
          : "Optional: load the sample shop alongside your existing rows (skips if already loaded)."}
      </p>
      <button
        type="button"
        disabled={pending}
        data-testid="av-load-sample-shop"
        className="mt-2 h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
        onClick={() => run(() => loadDemoShopAction())}
      >
        {pending ? "Loading…" : "Load sample shop"}
      </button>
      {message ? (
        <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
