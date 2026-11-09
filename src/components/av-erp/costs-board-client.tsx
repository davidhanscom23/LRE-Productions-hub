"use client";

import Link from "next/link";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { JobFinanceSummary } from "@/lib/av-erp/job-finance";

type Props = { rows: JobFinanceSummary[] };

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function CostsBoardClient({ rows }: Props) {
  return (
    <AvErpPage maxWidthClassName="max-w-4xl">
      <h1 className="text-xl font-semibold">Costs & margin</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        What a job costs to deliver against what it earns. Revenue uses invoices
        when present, otherwise the estimate customer total.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium">Costs</th>
              <th className="px-4 py-3 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  No open jobs with revenue or costs yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.opportunityId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rentals/quotes/${row.opportunityId}`}
                      className="font-medium hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{row.subject}</p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {row.revenueSource === "invoices"
                        ? "from invoices"
                        : "from estimate"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{money(row.revenue)}</td>
                  <td className="px-4 py-3">{money(row.costs)}</td>
                  <td className="px-4 py-3 font-medium">
                    {money(row.margin)}
                    {row.marginPct != null ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        ({row.marginPct}%)
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AvErpPage>
  );
}
