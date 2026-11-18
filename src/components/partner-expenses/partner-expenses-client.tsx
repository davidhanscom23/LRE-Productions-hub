"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPartnerExpenseAction,
  editPartnerExpenseAction,
  setPartnerFlagAction,
  setPartnerReimbursedAction,
  voidPartnerExpenseAction,
} from "@/app/(app)/partner-expenses/actions";
import {
  PARTNER_CATEGORIES,
  PARTNER_NAMES,
  PARTNERS,
  categoryLabel,
  formatCents,
  summarize,
  type Partner,
  type PartnerExpense,
} from "@/lib/partner-expenses/shared";

type Props = { me: Partner; meId: string; expenses: PartnerExpense[] };
type Tab = "dashboard" | "expenses" | "add";

const WHO_STYLE: Record<Partner, string> = {
  david: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
  luke: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200",
};
const BAR: Record<Partner, string> = { david: "bg-indigo-500", luke: "bg-teal-500" };

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function WhoBadge({ who }: { who: Partner }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${WHO_STYLE[who]}`}>
      {PARTNER_NAMES[who]}
    </span>
  );
}

function StackBar({ david, luke, max }: { david: number; luke: number; max: number }) {
  const d = max ? (david / max) * 100 : 0;
  const l = max ? (luke / max) * 100 : 0;
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-[var(--border)]" aria-hidden="true">
      <span className={BAR.david} style={{ width: `${d}%` }} />
      <span className={BAR.luke} style={{ width: `${l}%` }} />
    </div>
  );
}

export function PartnerExpensesClient({ me, meId, expenses }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [who, setWho] = useState<"all" | Partner>("all");
  const [status, setStatus] = useState<"open" | "reimbursed" | "all">("all");
  const [showVoided, setShowVoided] = useState(false);
  const [editing, setEditing] = useState<PartnerExpense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagNote, setFlagNote] = useState("");

  const summary = useMemo(() => summarize(expenses), [expenses]);

  const visible = useMemo(
    () =>
      expenses.filter((e) => {
        if (!showVoided && e.voided_at) return false;
        if (who !== "all" && e.paid_by !== who) return false;
        if (status === "open" && e.reimbursed_at) return false;
        if (status === "reimbursed" && !e.reimbursed_at) return false;
        return true;
      }),
    [expenses, who, status, showVoided],
  );
  const visibleTotal = visible
    .filter((e) => !e.voided_at)
    .reduce((a, e) => a + e.amount_cents, 0);

  function run(action: () => Promise<{ error: string | null }>, done?: () => void) {
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        setNotice(res.error);
        return;
      }
      done?.();
      router.refresh();
    });
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const data = new FormData(form);
    setFormError(null);
    if (editing) data.set("id", editing.id);
    startTransition(async () => {
      const res = editing
        ? await editPartnerExpenseAction(data)
        : await addPartnerExpenseAction(data);
      if (res.error) {
        setFormError(res.error);
        return;
      }
      form.reset();
      setEditing(null);
      setTab("expenses");
      router.refresh();
    });
  }

  function startEdit(e: PartnerExpense) {
    setEditing(e);
    setFormError(null);
    setTab("add");
  }

  const gapLine =
    summary.gap === 0
      ? "David and Luke have paid exactly the same amount so far."
      : `${summary.gap > 0 ? "David" : "Luke"} has paid ${formatCents(Math.abs(summary.gap))} more than ${summary.gap > 0 ? "Luke" : "David"}.`;

  const catMax = Math.max(0, ...summary.byCategory.map((c) => c.david + c.luke));
  const monthRows = summary.byMonth.slice(-6);
  const monthMax = Math.max(0, ...monthRows.map((m) => m.david + m.luke));

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        if (t === "add" && tab !== "add") setEditing(null);
        setTab(t);
      }}
      aria-pressed={tab === t}
      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
        tab === t
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Partner expenses</h1>
        <p className="text-sm text-[var(--muted)]">
          LRE Productions startup costs paid personally by David and Luke. You are signed in as{" "}
          <strong>{PARTNER_NAMES[me]}</strong>. Every change is recorded in the{" "}
          <Link href="/partner-expenses/activity" className="underline">
            activity log
          </Link>
          .
        </p>
      </header>

      <div className="flex gap-2">
        {tabBtn("dashboard", "Dashboard")}
        {tabBtn("expenses", "Expenses")}
        {tabBtn("add", editing ? "Editing" : "+ Add")}
      </div>

      {notice ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {notice}
        </p>
      ) : null}

      {tab === "dashboard" ? (
        summary.count === 0 ? (
          <Card className="text-center">
            <p className="font-semibold text-[var(--foreground)]">No expenses yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Add the first one and this dashboard fills in for both of you.
            </p>
            <button type="button" onClick={() => setTab("add")} className="mt-4 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--background)]">
              + Add an expense
            </button>
          </Card>
        ) : (
          <>
            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Total spent together</p>
              <p className="text-4xl font-bold text-[var(--foreground)]">{formatCents(summary.total)}</p>
              <p className="text-sm text-[var(--muted)]">
                {summary.count} expense{summary.count === 1 ? "" : "s"}
                {summary.flagged ? ` · ${summary.flagged} flagged` : ""}
              </p>
              <div className="mt-3">
                <StackBar david={summary.david.total} luke={summary.luke.total} max={summary.total} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
                <span>David {summary.total ? Math.round((summary.david.total / summary.total) * 100) : 0}%</span>
                <span>Luke {summary.total ? 100 - Math.round((summary.david.total / summary.total) * 100) : 0}%</span>
              </div>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              {PARTNERS.map((p) => (
                <Card key={p}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-[var(--foreground)]">{PARTNER_NAMES[p]}</h2>
                    <WhoBadge who={p} />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{formatCents(summary[p].total)}</p>
                  <dl className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                    <div className="flex justify-between"><dt>Expenses</dt><dd className="font-medium text-[var(--foreground)]">{summary[p].count}</dd></div>
                    <div className="flex justify-between"><dt>Still to reimburse</dt><dd className="font-medium text-[var(--foreground)]">{formatCents(summary[p].outstanding)}</dd></div>
                    <div className="flex justify-between"><dt>Reimbursed</dt><dd className="font-medium text-[var(--foreground)]">{formatCents(summary[p].reimbursed)}</dd></div>
                  </dl>
                </Card>
              ))}
            </div>

            <Card>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Where things stand</p>
              <p className="mt-1 text-sm text-[var(--foreground)]">{gapLine}</p>
              <p className="mt-1 text-sm text-[var(--foreground)]">
                Still to be reimbursed: <strong>{formatCents(summary.outstanding)}</strong> (David{" "}
                {formatCents(summary.david.outstanding)} · Luke {formatCents(summary.luke.outstanding)}).
              </p>
            </Card>

            <Card>
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">By category</p>
              <div className="space-y-2">
                {summary.byCategory.map((c) => (
                  <div key={c.category} className="grid grid-cols-[110px_1fr_84px] items-center gap-2 text-sm">
                    <span className="truncate text-[var(--foreground)]">{categoryLabel(c.category)}</span>
                    <StackBar david={c.david} luke={c.luke} max={catMax} />
                    <span className="text-right tabular-nums text-[var(--foreground)]">{formatCents(c.david + c.luke)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                <span className="text-indigo-500">■</span> David <span className="ml-3 text-teal-500">■</span> Luke
              </p>
            </Card>

            {monthRows.length ? (
              <Card>
                <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">By month</p>
                <div className="space-y-2">
                  {monthRows.map((m) => (
                    <div key={m.month} className="grid grid-cols-[110px_1fr_84px] items-center gap-2 text-sm">
                      <span className="text-[var(--foreground)]">{monthLabel(m.month)}</span>
                      <StackBar david={m.david} luke={m.luke} max={monthMax} />
                      <span className="text-right tabular-nums text-[var(--foreground)]">{formatCents(m.david + m.luke)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )
      ) : null}

      {tab === "expenses" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(["all", "david", "luke"] as const).map((w) => (
              <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)}
                className={`rounded-full border px-3 py-1.5 text-sm ${who === w ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"}`}>
                {w === "all" ? "Everyone" : PARTNER_NAMES[w]}
              </button>
            ))}
            {(["all", "open", "reimbursed"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1.5 text-sm ${status === s ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"}`}>
                {s === "all" ? "Any status" : s === "open" ? "To reimburse" : "Reimbursed"}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
              Show voided
            </label>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {visible.length} expense{visible.length === 1 ? "" : "s"} · {formatCents(visibleTotal)}
          </p>

          {visible.length === 0 ? (
            <Card className="text-center text-sm text-[var(--muted)]">
              {expenses.length ? "Nothing matches these filters." : "No expenses yet."}
            </Card>
          ) : (
            visible.map((e) => {
              const mine = e.created_by === meId;
              const voided = Boolean(e.voided_at);
              return (
                <article key={e.id} className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${voided ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <WhoBadge who={e.paid_by} />
                    <span className={`text-lg font-bold tabular-nums text-[var(--foreground)] ${voided ? "line-through" : ""}`}>{formatCents(e.amount_cents)}</span>
                  </div>
                  <p className="mt-1.5 break-words font-semibold text-[var(--foreground)]">{e.description}</p>
                  <p className="break-words text-sm text-[var(--muted)]">
                    {fmtDate(e.expense_date)} · {categoryLabel(e.category)}
                    {e.note ? ` · ${e.note}` : ""}
                    {e.reimbursed_at ? " · Reimbursed" : ""}
                  </p>
                  {voided ? (
                    <p className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">Voided: {e.void_reason}</p>
                  ) : null}
                  {e.flagged_at && !voided ? (
                    <p className="mt-1 rounded-lg bg-amber-100 px-3 py-1.5 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                      Flagged: {e.flag_note}
                    </p>
                  ) : null}
                  {e.receipt_url ? (
                    <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm underline">
                      {e.receipt_name ? `Receipt (${e.receipt_name})` : "View receipt"}
                    </a>
                  ) : null}

                  {!voided ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                        onClick={() => run(() => setPartnerReimbursedAction(e.id, !e.reimbursed_at))}>
                        {e.reimbursed_at ? "Undo reimbursed" : "Mark reimbursed"}
                      </button>
                      {mine ? (
                        <>
                          <button type="button" disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm" onClick={() => startEdit(e)}>Edit</button>
                          <button type="button" disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                            onClick={() => { setVoidingId(voidingId === e.id ? null : e.id); setVoidReason(""); }}>
                            Void
                          </button>
                        </>
                      ) : e.flagged_at ? (
                        <button type="button" disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                          onClick={() => run(() => setPartnerFlagAction(e.id, false, ""))}>
                          Clear flag
                        </button>
                      ) : (
                        <button type="button" disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                          onClick={() => { setFlaggingId(flaggingId === e.id ? null : e.id); setFlagNote(""); }}>
                          Flag a question
                        </button>
                      )}
                      {mine && e.flagged_at ? (
                        <button type="button" disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                          onClick={() => run(() => setPartnerFlagAction(e.id, false, ""))}>
                          Clear flag
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {voidingId === e.id ? (
                    <div className="mt-3 space-y-2">
                      <label className="block text-sm text-[var(--muted)]" htmlFor={`void-${e.id}`}>Why is this being voided? It stays on the record.</label>
                      <input id={`void-${e.id}`} value={voidReason} onChange={(ev) => setVoidReason(ev.target.value)} maxLength={300}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                      <button type="button" disabled={pending} className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
                        onClick={() => run(() => voidPartnerExpenseAction(e.id, voidReason), () => setVoidingId(null))}>
                        Confirm void
                      </button>
                    </div>
                  ) : null}

                  {flaggingId === e.id ? (
                    <div className="mt-3 space-y-2">
                      <label className="block text-sm text-[var(--muted)]" htmlFor={`flag-${e.id}`}>What would you like to ask about this expense?</label>
                      <input id={`flag-${e.id}`} value={flagNote} onChange={(ev) => setFlagNote(ev.target.value)} maxLength={300}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                      <button type="button" disabled={pending} className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-semibold text-[var(--background)]"
                        onClick={() => run(() => setPartnerFlagAction(e.id, true, flagNote), () => setFlaggingId(null))}>
                        Send flag
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </>
      ) : null}

      {tab === "add" ? (
        <Card>
          <form key={editing?.id ?? "new"} onSubmit={onSubmit} className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{editing ? "Edit expense" : "Add an expense"}</h2>
            <fieldset>
              <legend className="text-sm text-[var(--muted)]">Whose expense is this? (who paid)</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {PARTNERS.map((p) => (
                  <label key={p} className="cursor-pointer">
                    <input type="radio" name="paid_by" value={p} defaultChecked={(editing?.paid_by ?? me) === p} className="peer sr-only" />
                    <span className="block rounded-xl border border-[var(--border)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--foreground)] peer-checked:border-[var(--foreground)] peer-checked:bg-[var(--foreground)] peer-checked:text-[var(--background)] peer-focus-visible:outline peer-focus-visible:outline-2">
                      {PARTNER_NAMES[p]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm text-[var(--muted)]">Amount (USD)
              <input name="amount" inputMode="decimal" autoComplete="off" required placeholder="0.00"
                defaultValue={editing ? (editing.amount_cents / 100).toFixed(2) : ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)]" />
            </label>
            <label className="block text-sm text-[var(--muted)]">What was it for?
              <input name="description" required maxLength={140} placeholder="e.g. Wireless mic kit"
                defaultValue={editing?.description ?? ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)]" />
            </label>
            <label className="block text-sm text-[var(--muted)]">Date
              <input name="expense_date" type="date" required
                defaultValue={editing?.expense_date ?? new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)]" />
            </label>
            <label className="block text-sm text-[var(--muted)]">Category
              <select name="category" defaultValue={editing?.category ?? "equipment"}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)]">
                {PARTNER_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </label>
            <label className="block text-sm text-[var(--muted)]">Note (optional)
              <textarea name="note" rows={2} maxLength={300} defaultValue={editing?.note ?? ""}
                placeholder="Vendor, anything useful for the books"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)]" />
            </label>
            <label className="block text-sm text-[var(--muted)]">Receipt photo or PDF (optional, up to 12 MB)
              <input name="receipt" type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm text-[var(--foreground)]" />
              {editing?.receipt_name ? <span className="mt-1 block text-xs">Current: {editing.receipt_name}. Choosing a new file replaces it; the old one stays on record.</span> : null}
            </label>
            {formError ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{formError}</p> : null}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--background)] disabled:opacity-60">
                {pending ? "Saving…" : editing ? "Save changes" : "Save expense"}
              </button>
              {editing ? (
                <button type="button" onClick={() => { setEditing(null); setTab("expenses"); }} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
