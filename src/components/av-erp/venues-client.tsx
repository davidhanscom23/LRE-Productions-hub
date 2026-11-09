"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  createJobVenueAction,
  updateJobVenueAction,
} from "@/app/(app)/rentals/venues/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { AvJobVenue } from "@/lib/av-erp/types";

type Props = { venues: AvJobVenue[] };

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
  access_notes: "",
  power_notes: "",
  parking_notes: "",
  notes: "",
  is_retired: false,
};

export function VenuesClient({ venues }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [editing, setEditing] = useState<AvJobVenue | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return venues.filter((v) => {
      if (!showRetired && v.is_retired) return false;
      if (!q) return true;
      return [v.name, v.city, v.address_line1, v.contact_name]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [venues, query, showRetired]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setCreating(true);
  }

  function openEdit(v: AvJobVenue) {
    setCreating(false);
    setEditing(v);
    setForm({
      name: v.name,
      contact_name: v.contact_name,
      email: v.email,
      phone: v.phone,
      address_line1: v.address_line1,
      city: v.city,
      region: v.region,
      postal_code: v.postal_code,
      access_notes: v.access_notes,
      power_notes: v.power_notes,
      parking_notes: v.parking_notes,
      notes: v.notes,
      is_retired: v.is_retired,
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
        ? await updateJobVenueAction(fd)
        : await createJobVenueAction(fd);
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
            Venues
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Rental job venues (access, power, parking). Separate from Event
            Packet venue folders.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add venue
        </button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search venues"
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
          <h2 className="text-sm font-semibold">
            {editing ? "Edit venue" : "New venue"}
          </h2>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">Name *</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
              />
            </label>
            {(
              [
                ["contact_name", "Contact"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["address_line1", "Address"],
                ["city", "City"],
                ["region", "State / region"],
                ["postal_code", "Postal code"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">{label}</span>
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={fieldClass}
                />
              </label>
            ))}
            {(
              [
                ["access_notes", "Access"],
                ["power_notes", "Power"],
                ["parking_notes", "Parking"],
                ["notes", "Notes"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[var(--muted)]">{label}</span>
                <textarea
                  rows={2}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          {editing ? (
            <label className="flex items-center gap-2 text-sm">
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
            No venues yet. Add one here, or load a sample shop from Overview.
          </li>
        ) : (
          filtered.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => openEdit(v)}
                className="w-full px-4 py-3 text-left hover:bg-[var(--surface-hover)]"
              >
                <p className="font-medium text-[var(--foreground)]">
                  {v.name}
                  {v.is_retired ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      retired
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                  {[v.address_line1, v.city, v.region].filter(Boolean).join(", ") ||
                    "No address"}
                </p>
              </button>
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}
