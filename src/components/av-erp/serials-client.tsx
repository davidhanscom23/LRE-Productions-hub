"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductUnitAction,
  updateProductUnitStatusAction,
} from "@/app/(app)/rentals/serials/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { AvProductUnit } from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type ProductOpt = { id: string; name: string; code: string };

type UnitRow = AvProductUnit & { product_name: string; product_code: string };

type Props = { units: UnitRow[]; products: ProductOpt[] };

export function SerialsClient({ units, products }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState("");

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
    run(async () => {
      const result = await createProductUnitAction(fd);
      if (result.ok) e.currentTarget.reset();
      return result;
    });
  }

  const q = scan.trim().toLowerCase();
  const visible = units.filter((u) => {
    if (!q) return true;
    return (
      u.serial.toLowerCase().includes(q) ||
      u.barcode.toLowerCase().includes(q) ||
      u.product_name.toLowerCase().includes(q) ||
      u.product_code.toLowerCase().includes(q)
    );
  });

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <h1 className="text-xl font-semibold">Serials</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Individual serialized assets (barcode / serial). Warehouse scan also
        matches product codes on checkout lists.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="mt-4 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2"
      >
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Product</span>
          <select name="product_id" required className={fieldClass}>
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.code ? ` (${p.code})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Serial</span>
          <input name="serial" required className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Barcode</span>
          <input name="barcode" className={fieldClass} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Notes</span>
          <input name="notes" className={fieldClass} />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add unit
          </button>
        </div>
      </form>

      <label className="mt-6 block max-w-md text-sm">
        <span className="mb-1 block text-[var(--muted)]">Filter</span>
        <input
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder="Serial, barcode, product…"
          className={fieldClass}
        />
      </label>

      <ul className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {visible.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No serial units yet.
          </li>
        ) : (
          visible.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="font-medium">{u.serial}</p>
                <p className="text-xs text-[var(--muted)]">
                  {u.product_name}
                  {u.product_code ? ` · ${u.product_code}` : ""}
                  {u.barcode && u.barcode !== u.serial
                    ? ` · barcode ${u.barcode}`
                    : ""}
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  fd.set("id", u.id);
                  run(() => updateProductUnitStatusAction(fd));
                }}
                className="flex items-center gap-2"
              >
                <select
                  name="status"
                  defaultValue={u.status}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                >
                  <option value="in">In</option>
                  <option value="out">Out</option>
                  <option value="retired">Retired</option>
                </select>
                <button
                  type="submit"
                  disabled={pending}
                  className="text-sm text-[var(--brand)] hover:underline disabled:opacity-50"
                >
                  Save
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}
