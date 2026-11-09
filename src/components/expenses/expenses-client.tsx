"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteExpenseAction,
  markReimbursedAction,
  reviewExpenseAction,
  submitExpenseAction,
} from "@/app/(app)/expenses/actions";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  formatMoney,
  type ExpenseRequest,
  type ExpenseStatus,
} from "@/lib/types/expenses";

type Props = {
  isAdmin: boolean;
  myExpenses: ExpenseRequest[];
  adminExpenses: ExpenseRequest[];
};

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  denied: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
};

function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function ExpenseLine({ e }: { e: ExpenseRequest }) {
  const receiptHref =
    e.receipt_access_url || e.receipt_url || null;
  const receiptLabel = e.receipt_file_name
    ? `View receipt (${e.receipt_file_name})`
    : "View receipt";

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--foreground)]">
        {formatMoney(e.amount)} · {expenseCategoryLabel(e.category)}
        <span className="font-normal text-[var(--muted)]"> · {fmtDate(e.expense_date)}</span>
      </p>
      {e.description ? (
        <p className="text-sm text-[var(--muted)]">{e.description}</p>
      ) : null}
      {receiptHref ? (
        <a
          href={receiptHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[var(--brand)] hover:underline"
        >
          {receiptLabel}
        </a>
      ) : null}
    </div>
  );
}

export function ExpensesClient({ isAdmin, myExpenses, adminExpenses }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("travel");
  const [expenseDate, setExpenseDate] = useState(today);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const pendingAdmin = adminExpenses.filter((e) => e.status === "pending");
  const approvedUnpaid = adminExpenses.filter(
    (e) => e.status === "approved" && !e.reimbursed_at,
  );
  const reviewedAdmin = adminExpenses.filter((e) => e.status !== "pending");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    startTransition(async () => {
      const result = await submitExpenseAction({
        amount,
        category,
        description,
        expenseDate,
        receiptUrl,
        receiptFile,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setAmount("");
      setDescription("");
      setReceiptUrl("");
      setReceiptFile(null);
      setCategory("travel");
      setExpenseDate(today);
      setFormMessage("Expense submitted. An admin will review it.");
      router.refresh();
    });
  }

  function cancel(id: string) {
    if (!confirm("Delete this expense?")) return;
    startTransition(async () => {
      const r = await deleteExpenseAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function review(id: string, decision: "approved" | "denied") {
    startTransition(async () => {
      const r = await reviewExpenseAction({ id, decision });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function reimburse(id: string) {
    startTransition(async () => {
      const r = await markReimbursedAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Expenses
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Submit expenses for reimbursement and track their status.
        </p>
      </header>

      {isAdmin ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            To review
            {pendingAdmin.length > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
                {pendingAdmin.length}
              </span>
            ) : null}
          </h2>
          {pendingAdmin.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No expenses waiting on you.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pendingAdmin.map((e) => (
                <li key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {e.requester_name}
                      </p>
                      <ExpenseLine e={e} />
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" disabled={pending} onClick={() => review(e.id, "approved")} className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">Approve</button>
                      <button type="button" disabled={pending} onClick={() => review(e.id, "denied")} className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50">Deny</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {approvedUnpaid.length > 0 ? (
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Approved — awaiting reimbursement
              </h3>
              <ul className="mt-2 space-y-2">
                {approvedUnpaid.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                    <span className="text-sm text-[var(--foreground)]">
                      {e.requester_name} · {formatMoney(e.amount)} · {expenseCategoryLabel(e.category)}
                    </span>
                    <button type="button" disabled={pending} onClick={() => reimburse(e.id)} className="inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">Mark reimbursed</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Submit */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Submit an expense
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">Amount</span>
              <input type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]">
                {EXPENSE_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">Date</span>
              <input type="date" required max={today} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">Description</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Receipt upload{" "}
              <span className="text-[var(--muted)]">
                (optional — image or PDF)
              </span>
            </span>
            <input
              type="file"
              accept="image/*,application/pdf,.heic,.heif"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand-soft)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--brand)]"
            />
            {receiptFile ? (
              <p className="text-xs text-[var(--muted)]">{receiptFile.name}</p>
            ) : null}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Receipt link{" "}
              <span className="text-[var(--muted)]">
                (optional — paste a photo/Drive link)
              </span>
            </span>
            <input
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://…"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
          </label>
          {formError ? <p className="text-sm text-red-700 dark:text-red-300">{formError}</p> : null}
          {formMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{formMessage}</p> : null}
          <button type="submit" disabled={pending || !amount} className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? "Submitting…" : "Submit expense"}
          </button>
        </form>
      </Card>

      {/* My expenses */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">My expenses</h2>
        {myExpenses.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            You haven’t submitted any expenses yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {myExpenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <ExpenseLine e={e} />
                <div className="flex items-center gap-3">
                  {e.reimbursed_at ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      Reimbursed
                    </span>
                  ) : (
                    <StatusBadge status={e.status} />
                  )}
                  {e.status === "pending" ? (
                    <button type="button" disabled={pending} onClick={() => cancel(e.id)} className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-50">Cancel</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin && reviewedAdmin.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">All reviewed</h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {reviewedAdmin.slice(0, 30).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-[var(--foreground)]">
                  {e.requester_name} · {formatMoney(e.amount)} · {expenseCategoryLabel(e.category)}
                </span>
                {e.reimbursed_at ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Reimbursed</span>
                ) : (
                  <StatusBadge status={e.status} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
