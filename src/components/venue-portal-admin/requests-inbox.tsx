"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  convertVenueRequestToOpportunityAction,
  deleteRequestAction,
  updateRequestStatusAction,
} from "@/app/(app)/venue-quotes/actions";

export type RequestRow = {
  id: string;
  venue: string;
  createdAt: string;
  kind: string;
  role: string;
  contact: string;
  contactEmail: string;
  contactPhone: string;
  client: string;
  clientEmail: string;
  eventType: string;
  guests: number | null;
  days: { date?: string; startTime?: string; endTime?: string; start?: string; end?: string }[];
  notes: string;
  total: number;
  status: string;
  depositAmount: number;
  depositStatus: string;
  opportunityId: string | null;
};

const DEPOSIT_LABELS: Record<string, string> = {
  none: "",
  pending: "Deposit pending",
  paid: "Deposit paid",
  failed: "Deposit failed",
  canceled: "Deposit canceled",
};

const STATUSES = ["new", "contacted", "quoted", "booked", "lost"];
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function RequestsInbox({ rows: allRows }: { rows: RequestRow[] }) {
  const router = useRouter();
  let rows = allRows;
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.id, r.status])),
  );
  const [oppIds, setOppIds] = useState<Record<string, string>>(
    Object.fromEntries(
      rows.filter((r) => r.opportunityId).map((r) => [r.id, r.opportunityId!]),
    ),
  );
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function change(id: string, status: string) {
    const prev = statuses[id];
    setStatuses((s) => ({ ...s, [id]: status }));
    start(async () => {
      const res = await updateRequestStatusAction(id, status);
      if (!res.ok) {
        setError(res.error);
        setStatuses((s) => ({ ...s, [id]: prev }));
      }
    });
  }

  function remove(r: RequestRow) {
    if (!confirm(`Delete this request from ${r.contact || "this contact"}? This can't be undone.`)) return;
    start(async () => {
      const res = await deleteRequestAction(r.id);
      if (res.ok) setRemoved((s) => new Set(s).add(r.id));
      else setError(res.error);
    });
  }

  function convert(r: RequestRow) {
    setError(null);
    start(async () => {
      const res = await convertVenueRequestToOpportunityAction(r.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const opportunityId = res.data!.opportunityId;
      setOppIds((m) => ({ ...m, [r.id]: opportunityId }));
      setStatuses((s) => ({
        ...s,
        [r.id]: r.kind === "book" || r.depositStatus === "paid" ? "booked" : "quoted",
      }));
      router.push(`/rentals/quotes/${opportunityId}`);
    });
  }

  rows = rows.filter((r) => !removed.has(r.id));

  if (rows.length === 0) {
    return <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">No requests yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows.map((r) => {
        const opportunityId = oppIds[r.id] || r.opportunityId;
        return (
          <div key={r.id} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {r.venue} · {r.eventType || "Event"}{r.guests ? ` · ${r.guests} guests` : ""}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(r.createdAt).toLocaleString()} ·{" "}
                  {r.kind === "book" ? "Book now" : "Send a quote"} ·{" "}
                  {r.role === "venue_coordinator" ? "Venue coordinator" : "Planner"}
                  {r.depositStatus !== "none"
                    ? ` · ${DEPOSIT_LABELS[r.depositStatus] ?? r.depositStatus}${
                        r.depositAmount > 0 ? ` ${money(r.depositAmount)}` : ""
                      }`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{money(r.total)}</span>
                {opportunityId ? (
                  <Link
                    href={`/rentals/quotes/${opportunityId}`}
                    className="h-8 rounded-lg border border-[var(--border)] px-3 text-xs font-medium leading-8"
                  >
                    Open Hub quote
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => convert(r)}
                    className="h-8 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
                  >
                    Create Hub quote
                  </button>
                )}
                <select disabled={pending} value={statuses[r.id]} onChange={(e) => change(r.id, e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" disabled={pending} onClick={() => remove(r)} title="Delete request"
                  className="rounded-lg border border-[var(--border)] p-1.5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-1 text-sm sm:grid-cols-2">
              <p>
                <span className="text-[var(--muted-foreground)]">Contact: </span>
                {r.contact} · <a className="underline" href={`mailto:${r.contactEmail}`}>{r.contactEmail}</a>
                {r.contactPhone ? ` · ${r.contactPhone}` : ""}
              </p>
              {(r.client || r.clientEmail) && (
                <p>
                  <span className="text-[var(--muted-foreground)]">Client: </span>
                  {r.client} {r.clientEmail && <a className="underline" href={`mailto:${r.clientEmail}`}>{r.clientEmail}</a>}
                </p>
              )}
            </div>
            {r.days.length > 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">
                {r.days.map((d) => `${d.date ?? ""} ${d.startTime ?? d.start ?? ""}–${d.endTime ?? d.end ?? ""}`).join(" · ")}
              </p>
            )}
            {r.notes && <p className="text-sm">“{r.notes}”</p>}
          </div>
        );
      })}
    </div>
  );
}
