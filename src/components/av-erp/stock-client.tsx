"use client";

import Link from "next/link";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { StockRow } from "@/lib/av-erp/warehouse-data";

type Props = { rows: StockRow[] };

export function StockClient({ rows }: Props) {
  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Stock
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Hub-owned counts: qty owned from Catalog, currently out from
            Warehouse movements. Packages are hidden.
          </p>
        </div>
        <Link
          href="/rentals/warehouse"
          className="text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          Warehouse →
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Owned</th>
              <th className="px-4 py-3 font-medium">Out</th>
              <th className="px-4 py-3 font-medium">Free</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  No active products yet. Add them in Catalog.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.productId}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--foreground)]">
                      {row.name}
                    </p>
                    {row.code ? (
                      <p className="text-xs text-[var(--muted)]">{row.code}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.qtyOwned}</td>
                  <td className="px-4 py-3">{row.qtyOut}</td>
                  <td className="px-4 py-3 font-medium">{row.qtyFree}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AvErpPage>
  );
}
