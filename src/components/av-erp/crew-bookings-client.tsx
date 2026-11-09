"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBookingAction,
  deleteBookingAction,
  updateBookingStatusAction,
} from "@/app/(app)/rentals/crew/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { isoToDatetimeLocalEastern } from "@/lib/av-erp/datetime";
import {
  AV_BOOKING_STATUSES,
  AV_BOOKING_STATUS_LABELS,
} from "@/lib/av-erp/margin";
import type { AvBookingStatus, AvContractorBooking } from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Person = { id: string; full_name: string | null; email: string | null };
type Opp = {
  id: string;
  reference: string;
  subject: string;
  gear_starts_at: string | null;
  gear_ends_at: string | null;
};

type BookingRow = AvContractorBooking & {
  person_name: string;
  opportunity_reference: string;
};

type ContractorOpt = { id: string; name: string; day_rate: number | null };

type Props = {
  bookings: BookingRow[];
  people: Person[];
  contractors: ContractorOpt[];
  opportunities: Opp[];
  preselectOpportunityId: string | null;
  /** When set (YYYY-MM-DD), list is filtered to bookings overlapping that day. */
  filterDate?: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function CrewBookingsClient({
  bookings,
  people,
  contractors,
  opportunities,
  preselectOpportunityId,
  filterDate = null,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pre = opportunities.find((o) => o.id === preselectOpportunityId);
  const [opportunityId, setOpportunityId] = useState(
    preselectOpportunityId ?? opportunities[0]?.id ?? "",
  );

  const selected = opportunities.find((o) => o.id === opportunityId);

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
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(async () => {
      const result = await createBookingAction(fd);
      if (result.ok) form.reset();
      return result;
    });
  }

  return (
    <AvErpPage maxWidthClassName="max-w-4xl">
      <h1 className="text-xl font-semibold">Crew</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Book Hub people or external{" "}
        <Link
          href="/rentals/contractors"
          className="text-[var(--brand)] hover:underline"
        >
          contractors
        </Link>{" "}
        onto jobs. Confirmed bookings with a day rate can add a labor cost on
        the estimate (Eastern calendar days × rate). Pay and coverage still live in{" "}
        <Link href="/staffing" className="text-[var(--brand)] hover:underline">
          Staffing
        </Link>
        ,{" "}
        <Link
          href="/contractor-pay"
          className="text-[var(--brand)] hover:underline"
        >
          Contractor Pay
        </Link>
        , and{" "}
        <Link href="/people" className="text-[var(--brand)] hover:underline">
          People
        </Link>
        .
      </p>
      {filterDate ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Showing bookings that overlap{" "}
          <span className="font-medium text-[var(--foreground)]">
            {filterDate}
          </span>
          .{" "}
          <Link
            href="/rentals/crew"
            className="text-[var(--brand)] hover:underline"
          >
            Clear date filter
          </Link>
          {" · "}
          <Link
            href={`/staffing?from=${filterDate}&days=28`}
            className="text-[var(--brand)] hover:underline"
          >
            Staffing around this day
          </Link>
        </p>
      ) : null}

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
          <span className="mb-1 block text-[var(--muted)]">Estimate</span>
          <select
            name="opportunity_id"
            required
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
            className={fieldClass}
          >
            <option value="">—</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} · {o.subject}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Hub person</span>
          <select name="profile_id" className={fieldClass} defaultValue="">
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email || p.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">
            Or external contractor
          </span>
          <select name="contractor_id" className={fieldClass} defaultValue="">
            <option value="">—</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.day_rate != null ? ` · $${c.day_rate}/day` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Role</span>
          <input
            name="role_label"
            placeholder="A1, strike…"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Day rate</span>
          <input
            name="day_rate"
            type="number"
            min={0}
            step="0.01"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Start (Eastern)</span>
          <input
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={
              selected?.gear_starts_at
                ? isoToDatetimeLocalEastern(selected.gear_starts_at)
                : pre?.gear_starts_at
                  ? isoToDatetimeLocalEastern(pre.gear_starts_at)
                  : ""
            }
            key={`start-${opportunityId}`}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">End (Eastern)</span>
          <input
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={
              selected?.gear_ends_at
                ? isoToDatetimeLocalEastern(selected.gear_ends_at)
                : pre?.gear_ends_at
                  ? isoToDatetimeLocalEastern(pre.gear_ends_at)
                  : ""
            }
            key={`end-${opportunityId}`}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Status</span>
          <select name="status" defaultValue="confirmed" className={fieldClass}>
            {AV_BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AV_BOOKING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Notes</span>
          <input name="notes" className={fieldClass} />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="roll_into_costs"
            value="1"
            defaultChecked
            className="mt-1"
          />
          <span>
            Add labor cost when confirmed
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Uses day rate × inclusive Eastern days on the estimate Costs &amp;
              margin panel. Cancel or decline removes the synced cost.
            </span>
          </span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Book crew
          </button>
        </div>
      </form>

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {bookings.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No crew bookings yet.
          </li>
        ) : (
          bookings.map((b) => (
            <li key={b.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {b.person_name}
                    {b.role_label ? ` · ${b.role_label}` : ""}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    <Link
                      href={`/rentals/quotes/${b.opportunity_id}`}
                      className="text-[var(--brand)] hover:underline"
                    >
                      {b.opportunity_reference}
                    </Link>{" "}
                    · {DATE_FMT.format(new Date(b.starts_at))} →{" "}
                    {DATE_FMT.format(new Date(b.ends_at))}
                    {b.day_rate != null
                      ? ` · ${money(Number(b.day_rate))}/day`
                      : ""}
                    {b.roll_into_costs &&
                    b.status === "confirmed" &&
                    b.day_rate != null &&
                    Number(b.day_rate) > 0
                      ? " · labor cost synced"
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={b.status}
                    disabled={pending}
                    onChange={(e) => {
                      const fd = new FormData();
                      fd.set("id", b.id);
                      fd.set("opportunity_id", b.opportunity_id);
                      fd.set("status", e.target.value);
                      run(() => updateBookingStatusAction(fd));
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  >
                    {AV_BOOKING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {AV_BOOKING_STATUS_LABELS[s as AvBookingStatus]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("id", b.id);
                      fd.set("opportunity_id", b.opportunity_id);
                      run(() => deleteBookingAction(fd));
                    }}
                    className="text-xs text-red-700 dark:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}
