import Link from "next/link";
import {
  AV_OPPORTUNITY_STATUS_LABELS,
  type AvOpportunityStatus,
} from "@/lib/av-erp/types";
import type { HubOverviewStats } from "@/lib/av-erp/overview";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-2xl font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{label}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-hover)]"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {inner}
    </div>
  );
}

const STATUS_ORDER: AvOpportunityStatus[] = [
  "draft",
  "quotation",
  "order",
  "closed",
];

export function HubOverview({ stats }: { stats: HubOverviewStats }) {
  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Estimates & floor
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Open jobs, holds, warehouse, activities, and gear going out in the
            next 14 days.
          </p>
        </div>
        <Link
          href="/rentals/quotes"
          className="text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          All estimates →
        </Link>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <StatCard
            key={status}
            label={AV_OPPORTUNITY_STATUS_LABELS[status]}
            value={stats.byStatus[status]}
            href={`/rentals/quotes?status=${status}`}
          />
        ))}
        <StatCard
          label="Gear holds"
          value={stats.holdsCount}
          href="/rentals/quotes?holds=1"
        />
        <StatCard
          label="Still out"
          value={stats.stillOutCount}
          href="/rentals/warehouse?tab=out"
        />
        <StatCard
          label="Overdue returns"
          value={stats.overdueCount}
          href="/rentals/warehouse?tab=overdue"
        />
        <StatCard
          label="Activities due today"
          value={stats.activitiesDueToday}
          href="/rentals/activities?filter=due_today"
        />
        <StatCard
          label="Activities overdue"
          value={stats.activitiesOverdue}
          href="/rentals/activities?filter=overdue"
        />
        <StatCard
          label="Open invoices"
          value={stats.openInvoices}
          href="/rentals/invoices?status=open"
        />
        <StatCard
          label="Unpaid invoices"
          value={stats.unpaidInvoices}
          href="/rentals/invoices?status=unpaid"
        />
        <StatCard
          label="Overdue invoices"
          value={stats.overdueInvoices}
          href="/rentals/invoices?status=overdue"
        />
      </div>

      <div className="mt-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-sm font-semibold">Upcoming gear out</h3>
            <span className="text-xs text-[var(--muted)]">Next 14 days</span>
          </div>
          {stats.upcoming.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No open estimates with gear dates in the next two weeks.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {stats.upcoming.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/rentals/quotes/${row.id}`}
                    className="flex flex-col gap-0.5 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {row.reference}{" "}
                        <span className="font-normal text-[var(--muted)]">
                          · {row.subject}
                        </span>
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {row.customer_name ?? "No customer"} ·{" "}
                        {AV_OPPORTUNITY_STATUS_LABELS[row.status]}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-[var(--muted)]">
                      {formatWhen(row.gear_starts_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {stats.openTotal === 0 ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          No Hub estimates yet.{" "}
          <Link href="/rentals/quotes" className="text-[var(--brand)] hover:underline">
            Create one
          </Link>
          , or use{" "}
          <span className="text-[var(--foreground)]">Load sample shop</span>{" "}
          above.
        </p>
      ) : null}
    </section>
  );
}
