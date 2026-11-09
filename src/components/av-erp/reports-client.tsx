"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  AV_BOOKING_STATUS_LABELS,
  AV_JOB_COST_CATEGORY_LABELS,
  type AvBookingStatus,
  type AvJobCostCategory,
} from "@/lib/av-erp/margin";
import { AV_INVOICE_STATUS_LABELS } from "@/lib/av-erp/invoicing";
import {
  AV_REPORT_CATALOG,
  filterKmReports,
  filterReportCatalog,
  reportSectionBlurb,
  type AvReportSectionDef,
  type KmReportDef,
} from "@/lib/av-erp/report-catalog";
import {
  INVOICE_AGING_BUCKET_LABELS,
  type InvoiceAgingBucketId,
} from "@/lib/av-erp/report-helpers";
import type { AvReportsBundle } from "@/lib/av-erp/reports";
import {
  AV_OPPORTUNITY_STATUS_LABELS,
  type AvOpportunityStatus,
} from "@/lib/av-erp/types";

type Props = { data: AvReportsBundle };

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
});

function catalogEntry(id: string): AvReportSectionDef {
  const hit = AV_REPORT_CATALOG.find((s) => s.id === id);
  if (!hit) {
    throw new Error(`Missing report catalog entry: ${id}`);
  }
  return hit;
}

function Section({
  id,
  title,
  blurb,
  children,
}: {
  id: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-20">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{blurb}</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {children}
      </div>
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
      {message}
    </p>
  );
}

function KmIndex({
  query,
  reports,
}: {
  query: string;
  reports: KmReportDef[];
}) {
  if (reports.length === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--muted)]">
        No KM report names match “{query}”.
      </p>
    );
  }

  const mapped = reports.filter((r) => r.hubSectionId);
  const unmapped = reports.filter((r) => !r.hubSectionId);

  return (
    <div
      data-testid="av-reports-km-index"
      className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
    >
      <h2 className="text-sm font-semibold">KM report names</h2>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        All 19 KM Reports menu names. Linked rows jump to the closest Hub
        section; unmapped names stay listed so nothing looks missing.
      </p>
      {mapped.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
          {mapped.map((r) => (
            <li
              key={r.key}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2"
            >
              <a
                href={`#${r.hubSectionId}`}
                className="font-medium text-[var(--brand)] hover:underline"
              >
                {r.label}
              </a>
              <span className="text-xs text-[var(--muted)]">
                {r.key}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {unmapped.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
          {unmapped.map((r) => (
            <li key={r.key}>
              <span className="font-medium text-[var(--muted)]">{r.label}</span>
              <span className="ml-2 text-xs text-[var(--muted)]">
                ({r.key}) — {r.note ?? "No Hub report yet."}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ReportsClient({ data }: Props) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterReportCatalog(query), [query]);
  const visibleIds = useMemo(
    () => new Set(visible.map((s) => s.id)),
    [visible],
  );
  const kmVisible = useMemo(() => filterKmReports(query), [query]);
  const pipelineOpen =
    data.pipelineByStatus.draft +
    data.pipelineByStatus.quotation +
    data.pipelineByStatus.order;

  function show(id: string) {
    return visibleIds.has(id);
  }

  return (
    <AvErpPage maxWidthClassName="max-w-4xl">
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Shop reports from Hub data — profit, costs, AR, pipeline, warehouse,
        crew, and activities. Search accepts Hub titles or any of the 19 KM
        report names (e.g. whatsOut, oppCosts, profit).
      </p>
      <label className="mt-3 block max-w-md text-sm">
        <span className="sr-only">Filter reports</span>
        <input
          data-testid="av-reports-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter reports (e.g. whatsOut, oppCosts, aging…)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </label>
      <nav
        data-testid="av-reports-jump"
        className="mt-3 flex flex-wrap gap-2 text-xs"
      >
        {visible.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[var(--muted)] hover:border-[var(--brand)]/40 hover:text-[var(--foreground)]"
          >
            {s.jumpLabel}
          </a>
        ))}
      </nav>
      <KmIndex query={query} reports={kmVisible} />
      {visible.length === 0 && kmVisible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          No reports match “{query}”. Clear the filter to see all sections.
        </p>
      ) : null}

      {show("customer-income") ? (
        <Section
          id="customer-income"
          title={catalogEntry("customer-income").title}
          blurb={reportSectionBlurb(catalogEntry("customer-income"))}
        >
          {data.customerIncome.length === 0 ? (
            <Empty message="No invoiced customer income yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Invoices</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.customerIncome.map((row) => (
                  <tr key={row.customerId ?? row.customerName}>
                    <td className="px-4 py-3">
                      {row.customerId ? (
                        <Link
                          href="/rentals/customers"
                          className="font-medium hover:underline"
                        >
                          {row.customerName}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.customerName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.invoiceCount}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("rental-income") ? (
        <Section
          id="rental-income"
          title={catalogEntry("rental-income").title}
          blurb={reportSectionBlurb(catalogEntry("rental-income"))}
        >
          {data.rentalIncome.length === 0 ? (
            <Empty message="No rental product lines on quotation/order/closed jobs." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Lines</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.rentalIncome.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <Link
                        href="/rentals/catalog"
                        className="font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.code ? (
                        <p className="text-xs text-[var(--muted)]">{row.code}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.lineCount}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("sale-income") ? (
        <Section
          id="sale-income"
          title={catalogEntry("sale-income").title}
          blurb={reportSectionBlurb(catalogEntry("sale-income"))}
        >
          {data.saleIncome.length === 0 ? (
            <Empty message="No sale/consumable lines on quotation/order/closed jobs." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Lines</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.saleIncome.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.lineCount}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("service-income") ? (
        <Section
          id="service-income"
          title={catalogEntry("service-income").title}
          blurb={reportSectionBlurb(catalogEntry("service-income"))}
        >
          {data.serviceIncome.length === 0 ? (
            <Empty message="No service lines on quotation/order/closed jobs." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Lines</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.serviceIncome.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.lineCount}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("text-rentals") ? (
        <Section
          id="text-rentals"
          title={catalogEntry("text-rentals").title}
          blurb={reportSectionBlurb(catalogEntry("text-rentals"))}
        >
          {data.textRentals.length === 0 ? (
            <Empty message="No free-text rental (or untagged) estimate lines yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.textRentals.map((row) => (
                  <tr key={row.lineId}>
                    <td className="px-4 py-3 font-medium">{row.description}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rentals/quotes/${row.opportunityId}`}
                        className="text-[var(--brand)] hover:underline"
                      >
                        {row.opportunityReference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.qty}</td>
                    <td className="px-4 py-3 font-medium">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("text-sales") ? (
        <Section
          id="text-sales"
          title={catalogEntry("text-sales").title}
          blurb={reportSectionBlurb(catalogEntry("text-sales"))}
        >
          {data.textSales.length === 0 ? (
            <Empty message="No free-text sale estimate lines yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.textSales.map((row) => (
                  <tr key={row.lineId}>
                    <td className="px-4 py-3 font-medium">{row.description}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rentals/quotes/${row.opportunityId}`}
                        className="text-[var(--brand)] hover:underline"
                      >
                        {row.opportunityReference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.qty}</td>
                    <td className="px-4 py-3 font-medium">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("contacts") ? (
        <Section
          id="contacts"
          title={catalogEntry("contacts").title}
          blurb={reportSectionBlurb(catalogEntry("contacts"))}
        >
          {data.contacts.length === 0 ? (
            <Empty message="No customer or venue contacts with a name, email, or phone." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.contacts.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.contactName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={
                          row.kind === "customer"
                            ? "/rentals/customers"
                            : "/rentals/venues"
                        }
                        className="hover:underline"
                      >
                        {row.organizationName}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {row.kind === "customer" ? "Customer" : "Venue"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {row.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {row.phone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("profit") ? (
      <Section
        id="profit"
        title={catalogEntry("profit").title}
        blurb={reportSectionBlurb(catalogEntry("profit"))}
      >
        {data.profit.length === 0 ? (
          <Empty message="No open jobs with revenue or costs yet." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
                <th className="px-4 py-3 font-medium">Costs</th>
                <th className="px-4 py-3 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.profit.map((row) => (
                <tr key={row.opportunityId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rentals/quotes/${row.opportunityId}`}
                      className="font-medium hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{row.subject}</p>
                  </td>
                  <td className="px-4 py-3">{money(row.revenue)}</td>
                  <td className="px-4 py-3">{money(row.costs)}</td>
                  <td className="px-4 py-3 font-medium">
                    {money(row.margin)}
                    {row.marginPct != null ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        ({row.marginPct}%)
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("opp-costs") ? (
      <Section
        id="opp-costs"
        title={catalogEntry("opp-costs").title}
        blurb={reportSectionBlurb(catalogEntry("opp-costs"))}
      >
        {data.costsByCategory.length === 0 ? (
          <Empty message="No job costs booked yet." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Rows</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.costsByCategory.map((row) => (
                <tr key={row.category}>
                  <td className="px-4 py-3 font-medium">
                    {
                      AV_JOB_COST_CATEGORY_LABELS[
                        row.category as AvJobCostCategory
                      ]
                    }
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.count}</td>
                  <td className="px-4 py-3">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("sub-rent") ? (
        <Section
          id="sub-rent"
          title={catalogEntry("sub-rent").title}
          blurb={reportSectionBlurb(catalogEntry("sub-rent"))}
        >
          {data.subRentBySupplier.length === 0 ? (
            <Empty message="No sub-hire costs yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Rows</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.subRentBySupplier.map((row) => (
                  <tr key={row.supplierName}>
                    <td className="px-4 py-3 font-medium">{row.supplierName}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.count}</td>
                    <td className="px-4 py-3">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("opp-sub-rents") ? (
        <Section
          id="opp-sub-rents"
          title={catalogEntry("opp-sub-rents").title}
          blurb={reportSectionBlurb(catalogEntry("opp-sub-rents"))}
        >
          {data.oppSubRents.length === 0 ? (
            <Empty message="No opportunity sub-hire rows yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.oppSubRents.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rentals/quotes/${row.opportunityId}`}
                        className="font-medium hover:underline"
                      >
                        {row.opportunityReference}
                      </Link>
                      {row.description ? (
                        <p className="text-xs text-[var(--muted)]">
                          {row.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.supplierName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {money(row.amount + row.taxAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("sub-contract") ? (
        <Section
          id="sub-contract"
          title={catalogEntry("sub-contract").title}
          blurb={reportSectionBlurb(catalogEntry("sub-contract"))}
        >
          {data.subContracts.length === 0 ? (
            <Empty message="No labor costs with a supplier yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.subContracts.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">
                      {row.opportunityReference}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.supplierName}
                    </td>
                    <td className="px-4 py-3">
                      {money(row.amount + row.taxAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("ar") ? (
      <Section
        id="ar"
        title={catalogEntry("ar").title}
        blurb={reportSectionBlurb(catalogEntry("ar"))}
      >
        {data.openAr.length === 0 ? (
          <Empty message="No unpaid invoice balances." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Job / customer</th>
                <th className="px-4 py-3 font-medium">Outstanding</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.openAr.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rentals/invoices/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{row.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {row.opportunityReference ?? "—"}
                    {row.customerName ? ` · ${row.customerName}` : ""}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {money(row.outstanding)}
                    <p className="text-[10px] font-normal text-[var(--muted)]">
                      of {money(row.total)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {AV_INVOICE_STATUS_LABELS[row.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("payments") ? (
        <Section
          id="payments"
          title={catalogEntry("payments").title}
          blurb={reportSectionBlurb(catalogEntry("payments"))}
        >
          {data.payments.length === 0 ? (
            <Empty message="No payments recorded yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.payments.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {DAY_FMT.format(new Date(`${row.receivedAt}T12:00:00`))}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rentals/invoices/${row.invoiceId}`}
                        className="font-medium hover:underline"
                      >
                        {row.invoiceReference}
                      </Link>
                      {row.method ? (
                        <p className="text-xs text-[var(--muted)]">
                          {row.method}
                          {row.reference ? ` · ${row.reference}` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.customerName ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("partially-invoiced") ? (
        <Section
          id="partially-invoiced"
          title={catalogEntry("partially-invoiced").title}
          blurb={reportSectionBlurb(catalogEntry("partially-invoiced"))}
        >
          {data.partiallyInvoiced.length === 0 ? (
            <Empty message="No partially invoiced jobs." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Estimate</th>
                  <th className="px-4 py-3 font-medium">Invoiced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.partiallyInvoiced.map((row) => (
                  <tr key={row.opportunityId}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rentals/quotes/${row.opportunityId}`}
                        className="font-medium hover:underline"
                      >
                        {row.reference}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">{row.subject}</p>
                    </td>
                    <td className="px-4 py-3">{money(row.quoteCustomerTotal)}</td>
                    <td className="px-4 py-3">{money(row.invoiceTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("aging") ? (
      <Section
        id="aging"
        title={catalogEntry("aging").title}
        blurb={reportSectionBlurb(catalogEntry("aging"))}
      >
        {data.aging.length === 0 ? (
          <Empty message="No aging buckets — nothing outstanding." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Bucket</th>
                <th className="px-4 py-3 font-medium">Invoices</th>
                <th className="px-4 py-3 font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.aging.map((row) => (
                <tr key={row.bucket}>
                  <td className="px-4 py-3 font-medium">
                    {
                      INVOICE_AGING_BUCKET_LABELS[
                        row.bucket as InvoiceAgingBucketId
                      ]
                    }
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.count}</td>
                  <td className="px-4 py-3">{money(row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("pipeline") ? (
      <Section
        id="pipeline"
        title={catalogEntry("pipeline").title}
        blurb={`${pipelineOpen} open job${pipelineOpen === 1 ? "" : "s"} (Draft / Quotation / Order).`}
      >
        {data.pipeline.length === 0 ? (
          <Empty message="No open estimates." />
        ) : (
          <>
            <div className="flex flex-wrap gap-3 border-b border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
              {(["draft", "quotation", "order"] as AvOpportunityStatus[]).map(
                (s) => (
                  <span key={s}>
                    {AV_OPPORTUNITY_STATUS_LABELS[s]}:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {data.pipelineByStatus[s]}
                    </span>
                  </span>
                ),
              )}
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Gear window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.pipeline.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rentals/quotes/${row.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.reference}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {row.subject}
                        {row.customerName ? ` · ${row.customerName}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {AV_OPPORTUNITY_STATUS_LABELS[row.status]}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {row.gearStartsAt && row.gearEndsAt
                        ? `${DAY_FMT.format(new Date(row.gearStartsAt))} → ${DAY_FMT.format(new Date(row.gearEndsAt))}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>
      ) : null}

      {show("gear") ? (
      <Section
        id="gear"
        title={catalogEntry("gear").title}
        blurb={reportSectionBlurb(catalogEntry("gear"))}
      >
        {data.gearOut.length === 0 ? (
          <Empty message="No gear currently out." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.gearOut.map((row) => (
                <tr key={`${row.opportunityId}:${row.productId}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rentals/quotes/${row.opportunityId}`}
                      className="font-medium hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{row.subject}</p>
                  </td>
                  <td className="px-4 py-3">{row.productName}</td>
                  <td className="px-4 py-3">{row.stillOut}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.overdue ? (
                      <span className="font-medium text-red-700 dark:text-red-300">
                        Overdue
                      </span>
                    ) : (
                      "Out"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("overdue-gear") ? (
      <Section
        id="overdue-gear"
        title={catalogEntry("overdue-gear").title}
        blurb={reportSectionBlurb(catalogEntry("overdue-gear"))}
      >
        {data.overdueGear.length === 0 ? (
          <Empty message="Nothing overdue." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.overdueGear.map((row) => (
                <tr key={`od:${row.opportunityId}:${row.productId}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rentals/quotes/${row.opportunityId}`}
                      className="font-medium hover:underline"
                    >
                      {row.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.productName}</td>
                  <td className="px-4 py-3">{row.stillOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("checkout") ? (
      <Section
        id="checkout"
        title={catalogEntry("checkout").title}
        blurb={reportSectionBlurb(catalogEntry("checkout"))}
      >
        {data.checkoutReady.length === 0 ? (
          <Empty message="Nothing waiting to check out." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.checkoutReady.map((row) => (
                <tr key={`co:${row.opportunityId}:${row.productId}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rentals/warehouse`}
                      className="font-medium hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{row.subject}</p>
                  </td>
                  <td className="px-4 py-3">{row.productName}</td>
                  <td className="px-4 py-3">{row.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("stock") ? (
      <Section
        id="stock"
        title={catalogEntry("stock").title}
        blurb={reportSectionBlurb(catalogEntry("stock"))}
      >
        {data.lowStock.length === 0 ? (
          <Empty message="No owned items are fully out." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Owned</th>
                <th className="px-4 py-3 font-medium">Out</th>
                <th className="px-4 py-3 font-medium">Free</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.lowStock.map((row) => (
                <tr key={row.productId}>
                  <td className="px-4 py-3">
                    <Link
                      href="/rentals/stock"
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.code ? (
                      <p className="text-xs text-[var(--muted)]">{row.code}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.qtyOwned}</td>
                  <td className="px-4 py-3">{row.qtyOut}</td>
                  <td className="px-4 py-3 font-medium text-red-700 dark:text-red-300">
                    {row.qtyFree}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}

      {show("sales-stock") ? (
        <Section
          id="sales-stock"
          title={catalogEntry("sales-stock").title}
          blurb={reportSectionBlurb(catalogEntry("sales-stock"))}
        >
          {data.salesStock.length === 0 ? (
            <Empty message="No sale or consumable products." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Owned</th>
                  <th className="px-4 py-3 font-medium">Free</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.salesStock.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.kind}</td>
                    <td className="px-4 py-3">{row.qtyOwned}</td>
                    <td className="px-4 py-3">{row.qtyFree}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("never-booked") ? (
        <Section
          id="never-booked"
          title={catalogEntry("never-booked").title}
          blurb={reportSectionBlurb(catalogEntry("never-booked"))}
        >
          {data.neverBooked.length === 0 ? (
            <Empty message="Every active product has been on a job." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Owned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.neverBooked.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.name}</span>
                      {row.code ? (
                        <p className="text-xs text-[var(--muted)]">{row.code}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.kind}</td>
                    <td className="px-4 py-3">{row.qtyOwned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("stock-txns") ? (
        <Section
          id="stock-txns"
          title={catalogEntry("stock-txns").title}
          blurb={reportSectionBlurb(catalogEntry("stock-txns"))}
        >
          {data.stockTxns.length === 0 ? (
            <Empty message="No warehouse movements yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Dir</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.stockTxns.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {DATE_FMT.format(new Date(row.movedAt))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.productName}</span>
                      <p className="text-xs text-[var(--muted)]">
                        {row.opportunityReference ?? "—"}
                        {row.serial ? ` · #${row.serial}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.direction}
                    </td>
                    <td className="px-4 py-3">{row.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      {show("crew") ? (
      <Section
        id="crew"
        title={catalogEntry("crew").title}
        blurb={reportSectionBlurb(catalogEntry("crew"))}
      >
        {data.crewUpcoming.length === 0 ? (
          <Empty message="No upcoming crew bookings." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.crewUpcoming.map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm">
                <p className="font-medium">
                  {row.personName}
                  {row.roleLabel ? ` · ${row.roleLabel}` : ""}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  <Link
                    href={`/rentals/quotes/${row.opportunityId}`}
                    className="text-[var(--brand)] hover:underline"
                  >
                    {row.opportunityReference}
                  </Link>{" "}
                  · {DATE_FMT.format(new Date(row.startsAt))} →{" "}
                  {DATE_FMT.format(new Date(row.endsAt))}
                  {row.dayRate != null
                    ? ` · ${money(row.dayRate)}/day`
                    : ""}{" "}
                  ·{" "}
                  {
                    AV_BOOKING_STATUS_LABELS[
                      row.status as AvBookingStatus
                    ]
                  }
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      ) : null}

      {show("activities") ? (
      <Section
        id="activities"
        title={catalogEntry("activities").title}
        blurb={reportSectionBlurb(catalogEntry("activities"))}
      >
        {data.activitiesOpen.length === 0 ? (
          <Empty message="No open activities." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {[...data.activitiesOpen]
              .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue))
              .map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">
                    {row.subject}
                    {row.isOverdue ? (
                      <span className="ml-2 text-xs font-medium text-red-700 dark:text-red-300">
                        Overdue
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {DATE_FMT.format(new Date(row.due_at))}
                    {row.kind ? ` · ${row.kind}` : ""}
                    {row.opportunity_id && row.opportunity_reference ? (
                      <>
                        {" · "}
                        <Link
                          href={`/rentals/quotes/${row.opportunity_id}`}
                          className="text-[var(--brand)] hover:underline"
                        >
                          {row.opportunity_reference}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </Section>
      ) : null}

      {show("travel") ? (
      <Section
        id="travel"
        title={catalogEntry("travel").title}
        blurb={reportSectionBlurb(catalogEntry("travel"))}
      >
        {data.travelWindows.length === 0 ? (
          <Empty message="No gear windows in the next 14 days." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.travelWindows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rentals/quotes/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">
                      {row.subject}
                      {row.venueName ? ` · ${row.venueName}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {DAY_FMT.format(new Date(row.gearStartsAt))} →{" "}
                    {DAY_FMT.format(new Date(row.gearEndsAt))}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {[
                      row.hasHolds ? "Held" : null,
                      row.stillOut ? "Out" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      ) : null}
    </AvErpPage>
  );
}
