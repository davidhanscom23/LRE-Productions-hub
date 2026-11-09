"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteQuoteAction,
  deleteQuoteLineAction,
  markQuoteReadyAction,
  requestQuoteDiscountApprovalAction,
  reviewQuoteDiscountApprovalAction,
  updateQuoteMetaAction,
  upsertQuoteLineAction,
} from "@/app/(app)/quoting/actions";
import { createProposalFromQuoteAction } from "@/app/(app)/proposals/actions";
import {
  QUOTE_DEPARTMENT_OPTIONS,
  QUOTE_DISCOUNT_THRESHOLD,
  formatQuoteMoney,
  quoteStatusLabel,
  summarizeQuoteLines,
  type Quote,
  type QuoteDiscountApproval,
  type QuotePricingNote,
  type QuoteStatus,
} from "@/lib/types/quoting";

type Props = {
  isAdmin: boolean;
  quote: Quote;
  notes: QuotePricingNote[];
  approvals: QuoteDiscountApproval[];
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

export function QuotingDetailClient({
  isAdmin,
  quote,
  notes,
  approvals,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locked = quote.status === "pending_approval" && !isAdmin;

  const lines = quote.lines ?? [];
  const summary = summarizeQuoteLines(lines);

  const [clientName, setClientName] = useState(quote.client_name);
  const [eventName, setEventName] = useState(quote.event_name);
  const [eventDate, setEventDate] = useState(quote.event_date ?? "");
  const [department, setDepartment] = useState(quote.department);
  const [notesText, setNotesText] = useState(quote.notes);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [listPrice, setListPrice] = useState("");
  const [quotePrice, setQuotePrice] = useState("");
  const [lineError, setLineError] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const pendingApproval = approvals.find((a) => a.status === "pending");

  function saveMeta(event: FormEvent) {
    event.preventDefault();
    setMetaError(null);
    setMetaMsg(null);
    startTransition(async () => {
      const r = await updateQuoteMetaAction({
        id: quote.id,
        clientName,
        eventName,
        eventDate,
        department,
        notes: notesText,
      });
      if (r.error) {
        setMetaError(r.error);
        return;
      }
      setMetaMsg("Details saved.");
      router.refresh();
    });
  }

  function addLine(event: FormEvent) {
    event.preventDefault();
    setLineError(null);
    startTransition(async () => {
      const r = await upsertQuoteLineAction({
        quoteId: quote.id,
        label,
        quantity,
        listUnitPrice: listPrice,
        quoteUnitPrice: quotePrice || listPrice,
      });
      if (r.error) {
        setLineError(r.error);
        return;
      }
      setLabel("");
      setQuantity("1");
      setListPrice("");
      setQuotePrice("");
      router.refresh();
    });
  }

  function removeLine(lineId: string) {
    if (!confirm("Remove this line?")) return;
    startTransition(async () => {
      const r = await deleteQuoteLineAction({ quoteId: quote.id, lineId });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  function markReady() {
    setActionError(null);
    setActionMsg(null);
    startTransition(async () => {
      const r = await markQuoteReadyAction(quote.id);
      if (r.error) {
        setActionError(r.error);
        return;
      }
      setActionMsg("Quote marked ready.");
      router.refresh();
    });
  }

  function requestApproval(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    setActionMsg(null);
    startTransition(async () => {
      const r = await requestQuoteDiscountApprovalAction({
        quoteId: quote.id,
        reason,
      });
      if (r.error) {
        setActionError(r.error);
        return;
      }
      setActionMsg("Approval requested. Admins have been notified.");
      router.refresh();
    });
  }

  function review(decision: "approved" | "denied") {
    if (!pendingApproval) return;
    startTransition(async () => {
      const r = await reviewQuoteDiscountApprovalAction({
        approvalId: pendingApproval.id,
        decision,
      });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  function removeQuote() {
    if (!confirm("Delete this quote?")) return;
    startTransition(async () => {
      const r = await deleteQuoteAction(quote.id);
      if (r.error) alert(r.error);
      else router.push("/quoting");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <Link
          href="/quoting"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Quoting
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            {quote.client_name || "Quote"}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[quote.status]}`}
          >
            {quoteStatusLabel(quote.status)}
          </span>
        </div>
      </div>

      {notes.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Pricing notes · {quote.department}
          </h2>
          <ul className="mt-3 space-y-3">
            {notes.map((n) => (
              <li key={n.id}>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {n.title}
                  {n.department !== quote.department ? (
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                      {n.department}
                    </span>
                  ) : null}
                </p>
                {n.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
                    {n.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Details
        </h2>
        <form onSubmit={saveMeta} className="mt-3 space-y-3">
          <fieldset disabled={locked || pending} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Client</span>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Event</span>
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Event date</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Department</span>
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
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Internal notes</span>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
          </fieldset>
          {metaError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{metaError}</p>
          ) : null}
          {metaMsg ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {metaMsg}
            </p>
          ) : null}
          {!locked ? (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              Save details
            </button>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Locked while discount approval is pending.
            </p>
          )}
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Line items
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Enter the list/standard unit price and the price you’re quoting.
          Decreases over {Math.round(QUOTE_DISCOUNT_THRESHOLD * 100)}% on a line
          or the total need admin approval.
        </p>

        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No lines yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Item</th>
                  <th className="pb-2 font-semibold">Qty</th>
                  <th className="pb-2 font-semibold">List</th>
                  <th className="pb-2 font-semibold">Quoted</th>
                  <th className="pb-2 font-semibold">Ext.</th>
                  <th className="pb-2 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {lines.map((line) => {
                  const listExt = line.list_unit_price * line.quantity;
                  const quoteExt = line.quote_unit_price * line.quantity;
                  const pct =
                    listExt > 0 ? (listExt - quoteExt) / listExt : 0;
                  const breach = pct > QUOTE_DISCOUNT_THRESHOLD;
                  return (
                    <tr key={line.id}>
                      <td className="py-2 pr-2 text-[var(--foreground)]">
                        {line.label}
                        {breach ? (
                          <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {Math.round(pct * 100)}% off
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">{line.quantity}</td>
                      <td className="py-2 pr-2">
                        {formatQuoteMoney(line.list_unit_price)}
                      </td>
                      <td className="py-2 pr-2">
                        {formatQuoteMoney(line.quote_unit_price)}
                      </td>
                      <td className="py-2 pr-2">
                        {formatQuoteMoney(quoteExt)}
                      </td>
                      <td className="py-2">
                        {!locked ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => removeLine(line.id)}
                            className="text-xs text-[var(--muted)] hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--border)] pt-3 text-sm">
          <p>
            List total:{" "}
            <span className="font-semibold">
              {formatQuoteMoney(summary.listTotal)}
            </span>
          </p>
          <p>
            Quoted total:{" "}
            <span className="font-semibold">
              {formatQuoteMoney(summary.quoteTotal)}
            </span>
          </p>
          {summary.listTotal > 0 ? (
            <p
              className={
                summary.totalDecreasePct > QUOTE_DISCOUNT_THRESHOLD
                  ? "font-medium text-amber-700 dark:text-amber-300"
                  : "text-[var(--muted)]"
              }
            >
              {Math.round(summary.totalDecreasePct * 100)}% off total
            </p>
          ) : null}
        </div>

        {!locked ? (
          <form
            onSubmit={addLine}
            className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"
          >
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Add line
            </h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Description</span>
                <input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Qty</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">List $</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Quoted $</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quotePrice}
                  onChange={(e) => setQuotePrice(e.target.value)}
                  placeholder="Defaults to list"
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>
            </div>
            {lineError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                {lineError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Add line
            </button>
          </form>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Continue
        </h2>
        {quote.status === "ready" ? (
          <div className="mt-1 space-y-2">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Quote is ready. Edit lines to revise (returns to draft if pricing
              changes).
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setActionError(null);
                setActionMsg(null);
                startTransition(async () => {
                  const r = await createProposalFromQuoteAction(quote.id);
                  if (r.error) {
                    setActionError(r.error);
                    return;
                  }
                  if (r.id) router.push(`/proposals/${r.id}`);
                  else router.refresh();
                });
              }}
              className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create proposal PDF
            </button>
          </div>
        ) : summary.needsApproval ? (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            This quote is more than {Math.round(QUOTE_DISCOUNT_THRESHOLD * 100)}
            % below list on a line and/or the total. Request admin approval
            before marking ready.
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pricing is within the {Math.round(QUOTE_DISCOUNT_THRESHOLD * 100)}%
            band — you can mark this quote ready.
          </p>
        )}

        {isAdmin && pendingApproval ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => review("approved")}
              className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Approve discount
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => review("denied")}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              Deny discount
            </button>
          </div>
        ) : null}

        {!locked &&
        quote.status !== "ready" &&
        summary.needsApproval ? (
          <form onSubmit={requestApproval} className="mt-3 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Reason for discount</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional context for admins"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
            <button
              type="submit"
              disabled={pending || quote.status === "pending_approval"}
              className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {quote.status === "pending_approval"
                ? "Approval pending…"
                : "Request approval"}
            </button>
          </form>
        ) : null}

        {!locked && quote.status !== "ready" && !summary.needsApproval ? (
          <button
            type="button"
            disabled={pending || lines.length === 0}
            onClick={markReady}
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Mark ready
          </button>
        ) : null}

        {!locked &&
        quote.status !== "ready" &&
        summary.needsApproval ? (
          <button
            type="button"
            disabled={pending || lines.length === 0}
            onClick={markReady}
            className="mt-3 ml-0 inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-50 sm:ml-2"
            title="Only works if an admin already approved this pricing"
          >
            Mark ready (if already approved)
          </button>
        ) : null}

        {actionError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {actionError}
          </p>
        ) : null}
        {actionMsg ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            {actionMsg}
          </p>
        ) : null}

        {approvals.length > 0 ? (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Approval history
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
              {approvals.map((a) => (
                <li key={a.id}>
                  {a.status} · {formatQuoteMoney(a.list_total)} →{" "}
                  {formatQuoteMoney(a.quote_total)}
                  {a.review_note ? ` · ${a.review_note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={removeQuote}
          className="mt-4 text-xs font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-300 disabled:opacity-50"
        >
          Delete quote
        </button>
      </Card>
    </div>
  );
}
