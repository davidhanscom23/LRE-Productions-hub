"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createJobCostAction,
  deleteJobCostAction,
} from "@/app/(app)/rentals/costs/actions";
import {
  AV_JOB_COST_CATEGORIES,
  AV_JOB_COST_CATEGORY_LABELS,
} from "@/lib/av-erp/margin";
import type { JobFinanceSummary } from "@/lib/av-erp/job-finance";
import type { AvJobCost, AvSupplier } from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Props = {
  opportunityId: string;
  finance: JobFinanceSummary;
  costs: AvJobCost[];
  suppliers: Pick<AvSupplier, "id" | "name">[];
};

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function QuoteCostsPanel({
  opportunityId,
  finance,
  costs,
  suppliers,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("opportunity_id", opportunityId);
    run(async () => {
      const result = await createJobCostAction(fd);
      if (result.ok) e.currentTarget.reset();
      return result;
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold">Costs & margin</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--muted)]">
            Revenue ({finance.revenueSource})
          </dt>
          <dd className="font-medium">{money(finance.revenue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">Costs</dt>
          <dd className="font-medium">{money(finance.costs)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">Margin</dt>
          <dd className="font-semibold">
            {money(finance.margin)}
            {finance.marginPct != null ? ` (${finance.marginPct}%)` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">Shop real (pre-markup)</dt>
          <dd className="text-[var(--muted)]">{money(finance.realTotal)}</dd>
        </div>
      </dl>

      {error ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="mt-4 grid gap-2 sm:grid-cols-6 sm:items-end"
      >
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Description</span>
          <input name="description" className={fieldClass} />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-[var(--muted)]">Amount</span>
          <input
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
            className={fieldClass}
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-[var(--muted)]">Tax</span>
          <input
            name="tax_amount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            className={fieldClass}
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-[var(--muted)]">Category</span>
          <select name="category" defaultValue="other" className={fieldClass}>
            {AV_JOB_COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {AV_JOB_COST_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-[var(--muted)]">Supplier</span>
          <select name="supplier_id" className={fieldClass}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          Add cost
        </button>
      </form>

      <ul className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
        {costs.length === 0 ? (
          <li className="px-3 py-4 text-center text-xs text-[var(--muted)]">
            No costs booked on this job.
          </li>
        ) : (
          costs.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {c.description || AV_JOB_COST_CATEGORY_LABELS[c.category]}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {AV_JOB_COST_CATEGORY_LABELS[c.category]} · {c.cost_date}
                  {c.booking_id ? " · From crew" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span>{money(Number(c.amount))}</span>
                {c.booking_id ? (
                  <span className="text-xs text-[var(--muted)]">Synced</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("id", c.id);
                      fd.set("opportunity_id", opportunityId);
                      run(() => deleteJobCostAction(fd));
                    }}
                    className="text-xs text-red-700 dark:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
