"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createInvoiceFromOpportunityAction } from "@/app/(app)/rentals/invoices/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { isInvoiceOverdue } from "@/lib/av-erp/invoice-overdue";
import {
  AV_INVOICE_STATUS_LABELS,
  invoiceOutstanding,
} from "@/lib/av-erp/invoicing";
import type { AvInvoice, AvInvoiceStatus } from "@/lib/av-erp/types";

type OppOption = { id: string; reference: string; subject: string; status: string };

type Row = AvInvoice & {
  customer_name: string | null;
  opportunity_reference: string | null;
};

type InvoiceFilter = "all" | "open" | "unpaid" | "overdue";

type Props = {
  invoices: Row[];
  billableOpportunities: OppOption[];
  initialFilter?: InvoiceFilter;
};

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function matchesFilter(inv: Row, filter: InvoiceFilter) {
  if (filter === "all") return true;
  if (inv.status === "void" || inv.status === "paid") return false;
  if (filter === "open") return true;
  if (filter === "overdue") {
    return isInvoiceOverdue({
      status: inv.status,
      dueAt: inv.due_at,
      total: Number(inv.total),
      amountPaid: Number(inv.amount_paid),
      amountCredited: Number(inv.amount_credited),
    });
  }
  const outstanding = invoiceOutstanding(
    Number(inv.total),
    Number(inv.amount_paid),
    Number(inv.amount_credited),
  );
  return outstanding > 0.001;
}

export function InvoicesListClient({
  invoices,
  billableOpportunities,
  initialFilter = "all",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [oppId, setOppId] = useState(billableOpportunities[0]?.id ?? "");
  const [filter, setFilter] = useState<InvoiceFilter>(initialFilter);

  const visible = useMemo(
    () => invoices.filter((inv) => matchesFilter(inv, filter)),
    [invoices, filter],
  );

  function setFilterAndUrl(next: InvoiceFilter) {
    setFilter(next);
    router.replace(
      next === "all" ? "/rentals/invoices" : `/rentals/invoices?status=${next}`,
    );
  }

  function createFromQuote() {
    if (!oppId) return;
    setError(null);
    startTransition(async () => {
      const result = await createInvoiceFromOpportunityAction(oppId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.id) router.push(`/rentals/invoices/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <AvErpPage maxWidthClassName="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Draft from a Hub estimate using customer-facing prices (markup folded
            in).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={oppId}
            onChange={(e) => setOppId(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="">Pick an estimate…</option>
            {billableOpportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} · {o.subject} ({o.status})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !oppId}
            onClick={createFromQuote}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Draft invoice
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["all", "All"],
            ["open", "Open"],
            ["unpaid", "Unpaid"],
            ["overdue", "Overdue"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilterAndUrl(id)}
            className={
              filter === id
                ? "rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {visible.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {invoices.length === 0
              ? "No invoices yet. Draft one from a quotation or order (sample quotation loads from Overview → Load sample shop)."
              : "No invoices match this filter."}
          </li>
        ) : (
          visible.map((inv) => {
            const outstanding = invoiceOutstanding(
              Number(inv.total),
              Number(inv.amount_paid),
              Number(inv.amount_credited),
            );
            return (
              <li key={inv.id}>
                <Link
                  href={`/rentals/invoices/${inv.id}`}
                  className="flex flex-col gap-0.5 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {inv.reference}{" "}
                      <span className="font-normal text-[var(--muted)]">
                        · {inv.subject}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {inv.customer_name ?? "No customer"}
                      {inv.opportunity_reference
                        ? ` · ${inv.opportunity_reference}`
                        : ""}{" "}
                      ·{" "}
                      {AV_INVOICE_STATUS_LABELS[inv.status as AvInvoiceStatus]}
                    </p>
                  </div>
                  <div className="shrink-0 text-sm">
                    {money(Number(inv.total))}
                    {outstanding > 0 && inv.status !== "void" ? (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                        due {money(outstanding)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </AvErpPage>
  );
}
