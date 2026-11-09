"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/app/(app)/rentals/customers/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { AvCustomer } from "@/lib/av-erp/types";

type Props = { customers: AvCustomer[] };

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const emptyForm = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  address_line1: "",
  city: "",
  region: "",
  postal_code: "",
  notes: "",
  standing_discount_pct: "0",
  tax_exempt: false,
  is_quotable: true,
  is_retired: false,
};

export function CustomersClient({ customers }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [editing, setEditing] = useState<AvCustomer | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (!showRetired && c.is_retired) return false;
      if (!q) return true;
      return [c.name, c.contact_name, c.email, c.phone, c.city]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [customers, query, showRetired]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setCreating(true);
  }

  function openEdit(c: AvCustomer) {
    setCreating(false);
    setEditing(c);
    setForm({
      name: c.name,
      contact_name: c.contact_name,
      email: c.email,
      phone: c.phone,
      address_line1: c.address_line1,
      city: c.city,
      region: c.region,
      postal_code: c.postal_code,
      notes: c.notes,
      standing_discount_pct: String(c.standing_discount_pct),
      tax_exempt: Boolean(c.tax_exempt),
      is_quotable: c.is_quotable,
      is_retired: c.is_retired,
    });
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (typeof v === "boolean") fd.set(k, v ? "on" : "off");
      else fd.set(k, v);
    });
    if (editing) fd.set("id", editing.id);

    startTransition(async () => {
      const result = editing
        ? await updateCustomerAction(fd)
        : await createCustomerAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setEditing(null);
      router.refresh();
    });
  }

  const showForm = creating || editing;

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Customers
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Hub-owned rental customers for estimates and orders (replacing Current
            RMS members over time).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add customer
        </button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers"
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
          />
          Show retired
        </label>
      </div>

      {showForm ? (
        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {editing ? "Edit customer" : "New customer"}
          </h2>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company / name" required>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Contact">
              <input
                value={form.contact_name}
                onChange={(e) =>
                  setForm({ ...form, contact_name: e.target.value })
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Address">
              <input
                value={form.address_line1}
                onChange={(e) =>
                  setForm({ ...form, address_line1: e.target.value })
                }
                className={fieldClass}
              />
            </Field>
            <Field label="City">
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="State / region">
              <input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Postal code">
              <input
                value={form.postal_code}
                onChange={(e) =>
                  setForm({ ...form, postal_code: e.target.value })
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Standing discount %">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.standing_discount_pct}
                onChange={(e) =>
                  setForm({ ...form, standing_discount_pct: e.target.value })
                }
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={fieldClass}
            />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.tax_exempt}
                onChange={(e) =>
                  setForm({ ...form, tax_exempt: e.target.checked })
                }
              />
              Tax exempt
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_quotable}
                onChange={(e) =>
                  setForm({ ...form, is_quotable: e.target.checked })
                }
              />
              Quotable
            </label>
            {editing ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_retired}
                  onChange={(e) =>
                    setForm({ ...form, is_retired: e.target.checked })
                  }
                />
                Retired
              </label>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {filtered.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No customers yet. Add one here, or load a sample shop from Overview.
          </li>
        ) : (
          filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">
                    {c.name}
                    {c.is_retired ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        retired
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                    {[c.contact_name, c.email, c.phone, c.city]
                      .filter(Boolean)
                      .join(" · ") || "No contact details"}
                  </p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-[var(--muted)]">
                  {c.tax_exempt ? <span>Tax exempt</span> : null}
                  {c.standing_discount_pct > 0 ? (
                    <span>{c.standing_discount_pct}% off</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[var(--muted)]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
