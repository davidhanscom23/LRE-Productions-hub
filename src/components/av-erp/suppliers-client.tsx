"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSupplierAction,
  updateSupplierAction,
} from "@/app/(app)/rentals/suppliers/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { AvSupplier } from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Props = { suppliers: AvSupplier[] };

export function SuppliersClient({ suppliers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AvSupplier | null>(null);

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
      setEditing(null);
      router.refresh();
    });
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(async () => {
      const result = await createSupplierAction(fd);
      if (result.ok) e.currentTarget.reset();
      return result;
    });
  }

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <h1 className="text-xl font-semibold">Suppliers</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Vendors and sub-hire sources for Hub AV jobs.
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
          <span className="mb-1 block text-[var(--muted)]">Name</span>
          <input name="name" required className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Contact</span>
          <input name="contact_name" className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Email</span>
          <input name="email" type="email" className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Phone</span>
          <input name="phone" className={fieldClass} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Notes</span>
          <textarea name="notes" rows={2} className={fieldClass} />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add supplier
          </button>
        </div>
      </form>

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {suppliers.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No suppliers yet.
          </li>
        ) : (
          suppliers.map((s) => (
            <li key={s.id} className="px-4 py-3">
              {editing?.id === s.id ? (
                <form
                  className="grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("id", s.id);
                    run(() => updateSupplierAction(fd));
                  }}
                >
                  <input
                    name="name"
                    defaultValue={s.name}
                    required
                    className={fieldClass}
                  />
                  <input
                    name="contact_name"
                    defaultValue={s.contact_name}
                    className={fieldClass}
                  />
                  <input
                    name="email"
                    type="email"
                    defaultValue={s.email}
                    className={fieldClass}
                  />
                  <input
                    name="phone"
                    defaultValue={s.phone}
                    className={fieldClass}
                  />
                  <textarea
                    name="notes"
                    defaultValue={s.notes}
                    rows={2}
                    className={`${fieldClass} sm:col-span-2`}
                  />
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={s.is_active}
                      value="on"
                    />
                    Active
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {s.name}
                      {!s.is_active ? (
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          Inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {[s.contact_name, s.email, s.phone]
                        .filter(Boolean)
                        .join(" · ") || "No contact yet"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="text-xs font-semibold text-[var(--brand)] hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}
