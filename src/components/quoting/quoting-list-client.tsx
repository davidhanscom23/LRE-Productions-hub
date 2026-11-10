"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createQuoteAction,
  deleteQuotePricingNoteAction,
  reviewQuoteDiscountApprovalAction,
  saveQuotePricingNoteAction,
} from "@/app/(app)/quoting/actions";
import {
  QUOTE_DEPARTMENT_OPTIONS,
  formatQuoteMoney,
  quoteStatusLabel,
  type Quote,
  type QuoteDiscountApproval,
  type QuotePricingNote,
  type QuoteStatus,
} from "@/lib/types/quoting";

type Props = {
  isAdmin: boolean;
  notes: QuotePricingNote[];
  quotes: Quote[];
  pendingApprovals: QuoteDiscountApproval[];
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200",
  pending_approval:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  ready:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  denied: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const day = iso.includes("T") ? iso.slice(0, 10) : iso;
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function QuotingListClient({
  isAdmin,
  notes,
  quotes,
  pendingApprovals,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [noteDept, setNoteDept] = useState<string>("General");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [department, setDepartment] = useState("General");
  const [createError, setCreateError] = useState<string | null>(null);

  const [filterDept, setFilterDept] = useState<string>("all");

  const filteredNotes =
    filterDept === "all"
      ? notes
      : notes.filter((n) => n.department === filterDept);

  function saveNote(event: FormEvent) {
    event.preventDefault();
    setNoteError(null);
    startTransition(async () => {
      const result = await saveQuotePricingNoteAction({
        department: noteDept,
        title: noteTitle,
        body: noteBody,
      });
      if (result.error) {
        setNoteError(result.error);
        return;
      }
      setNoteTitle("");
      setNoteBody("");
      router.refresh();
    });
  }

  function removeNote(id: string) {
    if (!confirm("Delete this pricing note?")) return;
    startTransition(async () => {
      const r = await deleteQuotePricingNoteAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  function createQuote(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    startTransition(async () => {
      const result = await createQuoteAction({
        clientName,
        eventName,
        eventDate,
        department,
        notes: "",
      });
      if (result.error) {
        setCreateError(result.error);
        return;
      }
      if (result.id) router.push(`/quoting/${result.id}`);
      else router.refresh();
    });
  }

  function review(approvalId: string, decision: "approved" | "denied") {
    startTransition(async () => {
      const r = await reviewQuoteDiscountApprovalAction({
        approvalId,
        decision,
      });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Quoting
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Build event quotes with list vs quoted pricing. Decreases over 20% on
          a line or the total need admin approval before you can mark a quote
          ready. AV rental estimates live under LRE AV → Quotes.
        </p>
      </header>

      {isAdmin && pendingApprovals.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Discount approvals
            <span className="ml-2 inline-flex items-center rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
              {pendingApprovals.length}
            </span>
          </h2>
          <ul className="mt-3 space-y-3">
            {pendingApprovals.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-[var(--foreground)]">
                      {a.requester_name ?? "Staff"} ·{" "}
                      {formatQuoteMoney(a.list_total)} →{" "}
                      {formatQuoteMoney(a.quote_total)} (
                      {Math.round(a.total_decrease_pct * 100)}% off)
                    </p>
                    {a.reason ? (
                      <p className="text-[var(--muted)]">{a.reason}</p>
                    ) : null}
                    {a.line_breaches.length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Line breaches:{" "}
                        {a.line_breaches.map((b) => b.label).join(", ")}
                      </p>
                    ) : null}
                    <Link
                      href={`/quoting/${a.quote_id}`}
                      className="mt-1 inline-block text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      Open quote
                    </Link>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => review(a.id, "approved")}
                      className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => review(a.id, "denied")}
                      className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          New quote
        </h2>
        <form onSubmit={createQuote} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Client
              </span>
              <input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Event
              </span>
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Event date
              </span>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Department
              </span>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              >
                {QUOTE_DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {createError ? (
            <p className="text-sm text-red-700 dark:text-red-300">
              {createError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !clientName.trim()}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create quote"}
          </button>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Quotes
          </h2>
        </div>
        {quotes.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No quotes yet. Create one above.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/quoting/${q.id}`}
                    className="text-sm font-medium text-[var(--brand)] hover:underline"
                  >
                    {q.client_name || "Untitled"}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {q.department}
                    {q.event_name ? ` · ${q.event_name}` : ""}
                    {q.event_date ? ` · ${fmtDate(q.event_date)}` : ""}
                    {isAdmin && q.creator_name ? ` · ${q.creator_name}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[q.status]}`}
                >
                  {quoteStatusLabel(q.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Department pricing notes
          </h2>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs outline-none focus:border-[var(--brand)]"
          >
            <option value="all">All departments</option>
            {QUOTE_DEPARTMENT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Checklist and pricing guidance staff use while quoting. Editable by
          anyone on staff.
        </p>

        {filteredNotes.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No notes yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {filteredNotes.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {n.title}
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                        {n.department}
                      </span>
                    </p>
                    {n.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
                        {n.body}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeNote(n.id)}
                    className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={saveNote}
          className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"
        >
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Add note
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Department
              </span>
              <select
                value={noteDept}
                onChange={(e) => setNoteDept(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              >
                {QUOTE_DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Title
              </span>
              <input
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Ceremony package list rates"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Notes / checklist
            </span>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={4}
              placeholder="List rates, package inclusions, gotchas…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          {noteError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{noteError}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !noteTitle.trim()}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save note"}
          </button>
        </form>
      </Card>
    </div>
  );
}
