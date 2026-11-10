"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import {
  createVendorAction,
  requestVendorDeleteAction,
  reviewVendorDeleteRequestAction,
  syncVendorsSheetNowAction,
  updateVendorAction,
} from "@/app/(app)/vendors/actions";
import { DEPARTMENTS, type Department } from "@/lib/types/database";
import {
  VENDOR_CATEGORIES,
  vendorSearchHaystack,
  type Vendor,
  type VendorAuditEvent,
  type VendorDeleteRequest,
} from "@/lib/vendors/types";

type VendorsClientProps = {
  vendors: Vendor[];
  deleteRequests: Array<
    VendorDeleteRequest & { company_name?: string; requester_name?: string }
  >;
  auditEvents: Array<VendorAuditEvent & { actor_name?: string }>;
  isAdmin: boolean;
  sheetError?: string | null;
};

export function VendorsClient({
  vendors,
  deleteRequests,
  auditEvents,
  isAdmin,
  sheetError,
}: VendorsClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors.filter((v) => {
      if (preferredOnly && !v.preferred) return false;
      if (category && v.category !== category) return false;
      if (q && !vendorSearchHaystack(v).includes(q)) return false;
      return true;
    });
  }, [vendors, query, preferredOnly, category]);

  const pendingDeletes = deleteRequests.filter((r) => r.status === "pending");

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Vendors
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Company vendor directory with search, preferred flags, and change
            history. Updates sync to the LRE Google Sheet. Deletes need
            admin approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await syncVendorsSheetNowAction();
                  router.refresh();
                })
              }
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              Sync sheet
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add vendor
          </button>
        </div>
      </header>

      {sheetError ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          Sheet sync note: {sheetError}
        </p>
      ) : null}

      {isAdmin && pendingDeletes.length > 0 ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Pending delete requests
          </h2>
          <ul className="mt-3 space-y-2">
            {pendingDeletes.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {req.company_name ?? "Vendor"}
                  </p>
                  <p className="text-[var(--muted)]">
                    {req.requester_name ?? "Staff"}
                    {req.reason ? ` — ${req.reason}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs font-medium"
                    onClick={() =>
                      startTransition(async () => {
                        await reviewVendorDeleteRequestAction({
                          requestId: req.id,
                          decision: "declined",
                        });
                        router.refresh();
                      })
                    }
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-lg bg-[var(--brand)] px-2 text-xs font-semibold text-white"
                    onClick={() =>
                      startTransition(async () => {
                        await reviewVendorDeleteRequestAction({
                          requestId: req.id,
                          decision: "approved",
                        });
                        router.refresh();
                      })
                    }
                  >
                    Approve delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors…"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
        >
          <option value="">All categories</option>
          {VENDOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setPreferredOnly((v) => !v)}
          className={[
            "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm",
            preferredOnly
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
              : "border-[var(--border)] text-[var(--foreground)]",
          ].join(" ")}
        >
          <Star className="h-4 w-4" />
          Preferred
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center text-sm text-[var(--muted)]">
          No vendors match. Add one to start the directory.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((vendor) => (
            <li
              key={vendor.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">
                      {vendor.company_name}
                      {vendor.preferred ? (
                        <Star className="ml-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {vendor.category || "Uncategorized"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    onClick={() => {
                      setCreating(false);
                      setEditing(vendor);
                    }}
                    aria-label="Edit vendor"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--muted)] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                    onClick={() => {
                      const reason = window.prompt(
                        isAdmin
                          ? "Optional note for deleting this vendor:"
                          : "Why should this vendor be removed? (admin will approve)",
                        "",
                      );
                      if (reason === null) return;
                      startTransition(async () => {
                        await requestVendorDeleteAction({
                          vendorId: vendor.id,
                          reason,
                        });
                        router.refresh();
                      });
                    }}
                    aria-label="Request delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                {vendor.contact_name ? (
                  <div>Contact: {vendor.contact_name}</div>
                ) : null}
                {vendor.phone ? <div>Phone: {vendor.phone}</div> : null}
                {vendor.email ? <div>Email: {vendor.email}</div> : null}
                {vendor.website ? (
                  <div>
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--brand)] hover:underline"
                    >
                      Website
                    </a>
                  </div>
                ) : null}
                {vendor.departments?.length ? (
                  <div>Depts: {vendor.departments.join(", ")}</div>
                ) : null}
                {vendor.notes ? <div className="pt-1">{vendor.notes}</div> : null}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && auditEvents.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Recent changes
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {auditEvents.slice(0, 20).map((ev) => (
              <li key={ev.id} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
                <span>
                  <span className="text-[var(--foreground)]">
                    {ev.actor_name ?? "Someone"}
                  </span>{" "}
                  — {ev.summary}{" "}
                  <span className="text-xs">
                    ({new Date(ev.created_at).toLocaleString()})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {creating || editing ? (
        <VendorFormModal
          vendor={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function VendorFormModal({
  vendor,
  onClose,
}: {
  vendor: Vendor | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(vendor);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = vendor
        ? await updateVendorAction(vendor.id, formData)
        : await createVendorAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {editing ? "Edit vendor" : "Add vendor"}
        </h2>
        <div className="mt-4 grid gap-3">
          <Field
            label="Company"
            name="company_name"
            defaultValue={vendor?.company_name}
            required
          />
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Category</span>
            <input
              name="category"
              list="vendor-categories"
              defaultValue={vendor?.category}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            />
            <datalist id="vendor-categories">
              {VENDOR_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <Field
            label="Contact name"
            name="contact_name"
            defaultValue={vendor?.contact_name}
          />
          <Field label="Phone" name="phone" defaultValue={vendor?.phone} />
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={vendor?.email}
          />
          <Field
            label="Website"
            name="website"
            defaultValue={vendor?.website}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={vendor?.notes}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
          <fieldset>
            <legend className="mb-1 text-sm text-[var(--muted)]">
              Departments
            </legend>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map((dept) => (
                <label
                  key={dept}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    name="departments"
                    value={dept}
                    defaultChecked={vendor?.departments?.includes(
                      dept as Department,
                    )}
                  />
                  {dept}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="preferred"
              defaultChecked={vendor?.preferred}
            />
            Preferred vendor
          </label>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[var(--muted)]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
      />
    </label>
  );
}
