import { getCurrentProfile } from "@/lib/auth/profile";
import { canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { buildSalesReport, type ReportProject, type SourceRow } from "@/lib/honeybook/sales-report";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ range?: string }> };

const RANGES: Record<string, { label: string; days: number | null }> = {
  "90": { label: "Last 90 days", days: 90 },
  "365": { label: "Last 12 months", days: 365 },
  all: { label: "All time", days: null },
};

function daysAgo(days: number | null): string | null {
  return days ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10) : null;
}

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const money = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

function Table({ title, rows, first }: { title: string; rows: SourceRow[]; first: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">Nothing in this range yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="py-1 pr-3 font-medium">{first}</th>
                <th className="py-1 pr-3 text-right font-medium">Leads</th>
                <th className="py-1 pr-3 text-right font-medium">Booked</th>
                <th className="py-1 pr-3 text-right font-medium">Lost</th>
                <th className="py-1 pr-3 text-right font-medium">Open</th>
                <th className="py-1 pr-3 text-right font-medium">Booking rate</th>
                <th className="py-1 text-right font-medium">Booked value</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.source} className="border-t border-[var(--border)]">
                  <td className="py-1.5 pr-3">{r.source}</td>
                  <td className="py-1.5 pr-3 text-right">{r.total}</td>
                  <td className="py-1.5 pr-3 text-right">{r.booked}</td>
                  <td className="py-1.5 pr-3 text-right">{r.lost}</td>
                  <td className="py-1.5 pr-3 text-right">{r.open}</td>
                  <td className="py-1.5 pr-3 text-right">{pct(r.rate)}</td>
                  <td className="py-1.5 text-right">{money(r.bookedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function HoneyBookReportsPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canManageHoneyBookCrm(profile.role)) redirect("/honeybook");
  const { range } = await searchParams;
  const sel = RANGES[range ?? ""] ? (range as string) : "365";
  const days = RANGES[sel].days;
  const from = daysAgo(days);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("honeybook_projects")
    .select("stage, source_event, raw, budget, created_at, booked_at, project_type, record_type, merged_into")
    .limit(5000);
  const report = buildSalesReport((data ?? []) as ReportProject[], { from });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <a href="/honeybook" className="text-xs text-[var(--muted)] underline">← HoneyBook</a>
          <h1 className="text-xl font-semibold">Sales reports</h1>
          <p className="text-sm text-[var(--muted)]">
            How many leads turn into booked events, where they come from, and how fast. Partnerships are not counted.
          </p>
        </div>
        <nav className="flex gap-1.5 text-xs">
          {Object.entries(RANGES).map(([k, v]) => (
            <a
              key={k}
              href={`/honeybook/reports?range=${k}`}
              className={`rounded-lg border px-2.5 py-1.5 ${k === sel ? "border-[var(--foreground)] font-semibold" : "border-[var(--border)]"}`}
            >
              {v.label}
            </a>
          ))}
        </nav>
      </div>
      {error && <p className="text-sm text-red-600">Couldn’t load projects: {error.message}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Leads" value={String(report.total)} sub={`${report.open} still open`} />
        <Stat label="Booking rate" value={pct(report.bookingRate)} sub={`${report.booked} booked, ${report.lost} lost`} />
        <Stat label="Booked value" value={money(report.bookedValue)} sub={`avg ${money(report.avgBookedValue)}`} />
        <Stat
          label="Days to book"
          value={report.avgDaysToBook === null ? "—" : String(Math.round(report.avgDaysToBook))}
          sub="average, from inquiry"
        />
      </div>

      <Table title="By lead source" rows={report.bySource} first="Source" />
      <Table title="By project type" rows={report.byType} first="Type" />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">By month received</h2>
        {report.byMonth.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing in this range yet.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 text-right font-medium">Leads</th>
                <th className="py-1 text-right font-medium">Booked</th>
                <th className="py-1 text-right font-medium">Lost</th>
                <th className="py-1 text-right font-medium">Booked value</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {report.byMonth.map((m) => (
                <tr key={m.month} className="border-t border-[var(--border)]">
                  <td className="py-1.5">{m.month}</td>
                  <td className="py-1.5 text-right">{m.inquiries}</td>
                  <td className="py-1.5 text-right">{m.booked}</td>
                  <td className="py-1.5 text-right">{m.lost}</td>
                  <td className="py-1.5 text-right">{money(m.bookedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-[var(--muted)]">
        Booked means Retainer Paid, Paid in Full, or Completed. Booking rate is booked divided by booked plus lost, so open leads don’t drag it down. Lead source uses HoneyBook’s own lead-source field when it came across, otherwise how the card was created (email, website form, Hub, import).
      </p>
    </div>
  );
}
