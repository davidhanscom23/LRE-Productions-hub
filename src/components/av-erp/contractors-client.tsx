"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createContractorAction,
  updateContractorAction,
} from "@/app/(app)/rentals/contractors/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { AvContractor } from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Props = { contractors: AvContractor[] };

function money(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function ContractorsClient({ contractors }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AvContractor | null>(null);

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
      const result = await createContractorAction(fd);
      if (result.ok) e.currentTarget.reset();
      return result;
    });
  }

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <h1 className="text-xl font-semibold">Contractors</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        External freelancers for crew bookings who do not need a Hub login.
        Hub people still book from Crew → People.
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
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Skills (comma)</span>
          <input
            name="skills"
            placeholder="A1, Lighting"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Day rate</span>
          <input name="day_rate" type="number" step="0.01" className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Hour rate</span>
          <input
            name="hour_rate"
            type="number"
            step="0.01"
            className={fieldClass}
          />
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
            Add contractor
          </button>
        </div>
      </form>

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {contractors.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No contractors yet.
          </li>
        ) : (
          contractors.map((c) => (
            <li key={c.id} className="px-4 py-3">
              {editing?.id === c.id ? (
                <form
                  className="grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("id", c.id);
                    run(() => updateContractorAction(fd));
                  }}
                >
                  <input
                    name="name"
                    defaultValue={c.name}
                    required
                    className={fieldClass}
                  />
                  <input
                    name="contact_name"
                    defaultValue={c.contact_name}
                    className={fieldClass}
                  />
                  <input
                    name="email"
                    type="email"
                    defaultValue={c.email}
                    className={fieldClass}
                  />
                  <input
                    name="phone"
                    defaultValue={c.phone}
                    className={fieldClass}
                  />
                  <input
                    name="skills"
                    defaultValue={c.skills.join(", ")}
                    className={fieldClass}
                  />
                  <input
                    name="day_rate"
                    type="number"
                    step="0.01"
                    defaultValue={c.day_rate ?? ""}
                    className={fieldClass}
                  />
                  <input
                    name="hour_rate"
                    type="number"
                    step="0.01"
                    defaultValue={c.hour_rate ?? ""}
                    className={fieldClass}
                  />
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={c.notes}
                    className={`${fieldClass} sm:col-span-2`}
                  />
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={c.is_active}
                    />
                    Active
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {c.name}
                      {!c.is_active ? (
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {[c.contact_name, c.email, c.phone]
                        .filter(Boolean)
                        .join(" · ") || "No contact"}
                    </p>
                    {c.skills.length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {c.skills.join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Day {money(c.day_rate)} · Hour {money(c.hour_rate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="text-sm text-[var(--brand)] hover:underline"
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
