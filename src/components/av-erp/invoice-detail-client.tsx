"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addInvoiceLineAction,
  deleteInvoiceLineAction,
  disableInvoicePayLinkAction,
  downloadInvoicePdfAction,
  downloadReceiptPdfAction,
  enableInvoicePayLinkAction,
  issueCreditAction,
  markInvoiceSentAction,
  recordPaymentAction,
  sendInvoiceReminderAction,
  updateInvoiceHeaderAction,
  updateInvoiceLineAction,
  voidInvoiceAction,
} from "@/app/(app)/rentals/invoices/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  AV_INVOICE_STATUS_LABELS,
  invoiceLineTotal,
  invoiceOutstanding,
} from "@/lib/av-erp/invoicing";
import type {
  AvInvoice,
  AvInvoiceCredit,
  AvInvoiceLine,
  AvInvoiceStatus,
  AvPayment,
} from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Props = {
  invoice: AvInvoice;
  lines: AvInvoiceLine[];
  payments: AvPayment[];
  credits: AvInvoiceCredit[];
  customerName: string | null;
  opportunityReference: string | null;
};

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function InvoiceDetailClient({
  invoice,
  lines,
  payments,
  credits,
  customerName,
  opportunityReference,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [payPath, setPayPath] = useState<string | null>(
    invoice.pay_enabled && invoice.pay_token
      ? `/invoice/${invoice.pay_token}`
      : null,
  );
  const isDraft = invoice.status === "draft";
  const outstanding = invoiceOutstanding(
    Number(invoice.total),
    Number(invoice.amount_paid),
    Number(invoice.amount_credited),
  );
  const canSettle =
    invoice.status !== "void" &&
    invoice.status !== "draft" &&
    outstanding > 0;

  function run(
    action: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onPay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("invoice_id", invoice.id);
    run(() => recordPaymentAction(fd));
  }

  function onCredit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("invoice_id", invoice.id);
    run(() => issueCreditAction(fd));
  }

  function onHeader(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("invoice_id", invoice.id);
    run(() => updateInvoiceHeaderAction(fd));
  }

  function onAddLine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("invoice_id", invoice.id);
    run(async () => {
      const result = await addInvoiceLineAction(fd);
      if (result.ok) form.reset();
      return result;
    });
  }

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <Link
        href="/rentals/invoices"
        className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← Invoices
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {invoice.reference}{" "}
            <span className="font-normal text-[var(--muted)]">
              {AV_INVOICE_STATUS_LABELS[invoice.status as AvInvoiceStatus]}
            </span>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isDraft ? null : invoice.subject}
            {customerName ? `${isDraft ? "" : " · "}${customerName}` : ""}
            {opportunityReference ? (
              <>
                {" · "}
                <Link
                  href={`/rentals/quotes/${invoice.opportunity_id}`}
                  className="text-[var(--brand)] hover:underline"
                >
                  {opportunityReference}
                </Link>
              </>
            ) : null}
          </p>
          {isDraft ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Draft — edit lines and subject, then Mark sent to lock.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await downloadInvoicePdfAction(invoice.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const bytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
                  c.charCodeAt(0),
                );
                const blob = new Blob([bytes], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.fileName;
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Download invoice PDF
          </button>
          {payments.length > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await downloadReceiptPdfAction(invoice.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
                  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = result.fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                });
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Download receipt PDF
            </button>
          ) : null}
          {isDraft ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await markInvoiceSentAction(invoice.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  if (result.payPath) setPayPath(result.payPath);
                  if (result.emailedTo) {
                    setMessage(
                      `Marked sent. Pay link emailed to ${result.emailedTo}${
                        result.payPath ? ` (${result.payPath})` : ""
                      }.`,
                    );
                  } else if (result.payPath) {
                    setMessage(
                      `Marked sent. Pay link ready: ${result.payPath}${
                        result.emailError ? ` — ${result.emailError}` : ""
                      }`,
                    );
                  } else if (result.emailError) {
                    setMessage(`Marked sent. ${result.emailError}`);
                  }
                  router.refresh();
                });
              }}
              className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Mark sent
            </button>
          ) : null}
          {!isDraft && invoice.status !== "void" && outstanding > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await enableInvoicePayLinkAction(invoice.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setPayPath(result.path);
                  if (result.emailedTo) {
                    setMessage(
                      `Pay link emailed to ${result.emailedTo} (${result.path}).`,
                    );
                  } else {
                    setMessage(
                      `Pay link ready: ${result.path}${
                        result.emailError ? ` — ${result.emailError}` : ""
                      }`,
                    );
                  }
                  router.refresh();
                });
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              {payPath ? "Re-email pay link" : "Enable customer pay link"}
            </button>
          ) : null}
          {!isDraft && invoice.status !== "void" && outstanding > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await sendInvoiceReminderAction(invoice.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setPayPath(result.path);
                  if (result.emailedTo) {
                    setMessage(
                      `Reminder emailed to ${result.emailedTo} (${result.path}).`,
                    );
                  } else {
                    setMessage(
                      `Reminder not emailed${
                        result.emailError ? ` — ${result.emailError}` : ""
                      }. Pay link: ${result.path}`,
                    );
                  }
                  router.refresh();
                });
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Send reminder
            </button>
          ) : null}
          {payPath ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await disableInvoicePayLinkAction(invoice.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setPayPath(null);
                  setMessage("Customer pay link disabled.");
                  router.refresh();
                });
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)]"
            >
              Disable pay link
            </button>
          ) : null}
          {invoice.status !== "void" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => voidInvoiceAction(invoice.id))}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-red-700 dark:text-red-300"
            >
              Void
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {message}
          {payPath ? (
            <>
              {" "}
              <a
                href={payPath}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-2 hover:underline"
              >
                Open
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {payPath && !message ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Customer pay link:{" "}
          <a
            href={payPath}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
          >
            {payPath}
          </a>
        </p>
      ) : null}

      {isDraft ? (
        <form
          onSubmit={onHeader}
          className="mt-6 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2"
        >
          <h2 className="text-sm font-semibold sm:col-span-2">Header</h2>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Subject</span>
            <input
              name="subject"
              defaultValue={invoice.subject}
              required
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Issued</span>
            <input
              name="issued_at"
              type="date"
              defaultValue={invoice.issued_at ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Due</span>
            <input
              name="due_at"
              type="date"
              defaultValue={invoice.due_at ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Sales tax rate (%)
            </span>
            <input
              name="tax_rate_pct"
              type="number"
              min={0}
              max={100}
              step="0.0001"
              defaultValue={Number(invoice.tax_rate_pct) || 0}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Notes</span>
            <input
              name="notes"
              defaultValue={invoice.notes}
              className={fieldClass}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Save header
            </button>
          </div>
        </form>
      ) : null}

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {lines.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">
            No lines yet.
          </li>
        ) : (
          lines.map((line) =>
            isDraft ? (
              <li key={line.id} className="px-4 py-3">
                <form
                  className="grid gap-2 sm:grid-cols-12 sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("id", line.id);
                    fd.set("invoice_id", invoice.id);
                    run(() => updateInvoiceLineAction(fd));
                  }}
                >
                  <label className="block text-sm sm:col-span-5">
                    <span className="mb-1 block text-[var(--muted)]">
                      Description
                    </span>
                    <input
                      name="description"
                      defaultValue={line.description}
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-[var(--muted)]">Qty</span>
                    <input
                      name="qty"
                      type="number"
                      min={0.01}
                      step="0.01"
                      defaultValue={line.qty}
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-[var(--muted)]">
                      Unit price
                    </span>
                    <input
                      name="unit_price"
                      type="number"
                      step="0.01"
                      defaultValue={line.unit_price}
                      required
                      className={fieldClass}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                    <button
                      type="submit"
                      disabled={pending}
                      className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs font-medium disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", line.id);
                        fd.set("invoice_id", invoice.id);
                        run(() => deleteInvoiceLineAction(fd));
                      }}
                      className="h-9 rounded-lg px-2 text-xs text-red-700 dark:text-red-300 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </form>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Line{" "}
                  {money(
                    invoiceLineTotal(Number(line.qty), Number(line.unit_price)),
                  )}
                </p>
              </li>
            ) : (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{line.description}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {line.qty} × {money(Number(line.unit_price))}
                  </p>
                </div>
                <p className="shrink-0">
                  {money(
                    invoiceLineTotal(Number(line.qty), Number(line.unit_price)),
                  )}
                </p>
              </li>
            ),
          )
        )}
      </ul>

      {isDraft ? (
        <form
          onSubmit={onAddLine}
          className="mt-3 grid gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-12 sm:items-end"
        >
          <label className="block text-sm sm:col-span-5">
            <span className="mb-1 block text-[var(--muted)]">Add line</span>
            <input
              name="description"
              placeholder="Description"
              required
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Qty</span>
            <input
              name="qty"
              type="number"
              min={0.01}
              step="0.01"
              defaultValue={1}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Unit price</span>
            <input
              name="unit_price"
              type="number"
              step="0.01"
              defaultValue={0}
              className={fieldClass}
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add line
            </button>
          </div>
        </form>
      ) : null}

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--muted)]">Subtotal</dt>
          <dd>{money(Number(invoice.subtotal))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--muted)]">
            Sales tax
            {Number(invoice.tax_rate_pct) > 0
              ? ` (${Number(invoice.tax_rate_pct)}%)`
              : ""}
          </dt>
          <dd>{money(Number(invoice.tax_amount) || 0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--muted)]">Total</dt>
          <dd className="font-semibold">{money(Number(invoice.total))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--muted)]">Paid</dt>
          <dd>{money(Number(invoice.amount_paid))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--muted)]">Credited</dt>
          <dd>{money(Number(invoice.amount_credited))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--muted)]">Outstanding</dt>
          <dd className="font-medium">{money(outstanding)}</dd>
        </div>
      </dl>

      {canSettle ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={onPay}
            className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2"
          >
            <h2 className="text-sm font-semibold sm:col-span-2">Record payment</h2>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Amount</span>
              <input
                name="amount"
                type="number"
                min={0.01}
                step="0.01"
                defaultValue={outstanding}
                required
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Received</span>
              <input
                name="received_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Method</span>
              <input
                name="method"
                placeholder="Check, ACH, card…"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Reference</span>
              <input name="reference" className={fieldClass} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Apply payment
              </button>
            </div>
          </form>

          <form
            onSubmit={onCredit}
            className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2"
          >
            <h2 className="text-sm font-semibold sm:col-span-2">Issue credit</h2>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Amount</span>
              <input
                name="amount"
                type="number"
                min={0.01}
                step="0.01"
                required
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Issued</span>
              <input
                name="issued_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">Reason</span>
              <input
                name="reason"
                placeholder="Returned gear, price adjustment…"
                className={fieldClass}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Apply credit
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Payments</h2>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {payments.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              No payments yet.
            </li>
          ) : (
            payments.map((p) => (
              <li
                key={p.id}
                className="flex justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{money(Number(p.amount))}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {p.received_at}
                    {p.method ? ` · ${p.method}` : ""}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Credits</h2>
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {credits.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              No credit notes yet.
            </li>
          ) : (
            credits.map((c) => (
              <li
                key={c.id}
                className="flex justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {c.reference} · {money(Number(c.amount))}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {c.issued_at}
                    {c.reason ? ` · ${c.reason}` : ""}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </AvErpPage>
  );
}
