"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import {
  createOpportunityAction,
  deleteOpportunityAction,
} from "@/app/(app)/rentals/quotes/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  AV_OPPORTUNITY_STATUS_LABELS,
  type AvOpportunity,
  type AvOpportunityStatus,
} from "@/lib/av-erp/types";

type Row = AvOpportunity & {
  customer_name: string | null;
  venue_name: string | null;
  hold_count: number;
};

const FILTERS: Array<"all" | AvOpportunityStatus> = [
  "all",
  "draft",
  "quotation",
  "order",
  "closed",
];

const STATUS_SET = new Set<string>(["draft", "quotation", "order", "closed"]);

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusFromParam(raw: string | null): (typeof FILTERS)[number] {
  if (raw && STATUS_SET.has(raw)) return raw as AvOpportunityStatus;
  return "all";
}

export function QuotesListClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = statusFromParam(searchParams.get("status"));
  const initialHolds = searchParams.get("holds") === "1";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>(initialStatus);
  const [holdsOnly, setHoldsOnly] = useState(initialHolds);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pushFilters(nextStatus: (typeof FILTERS)[number], nextHolds: boolean) {
    setStatus(nextStatus);
    setHoldsOnly(nextHolds);
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextHolds) params.set("holds", "1");
    const qs = params.toString();
    router.replace(qs ? `/rentals/quotes?${qs}` : "/rentals/quotes");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (holdsOnly && r.hold_count <= 0) return false;
      if (!q) return true;
      return [
        r.reference,
        r.subject,
        r.customer_name ?? "",
        r.venue_name ?? "",
        r.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, status, holdsOnly]);

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Estimates
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Hub-owned opportunities (Draft → Quotation → Order → Closed). Gear
            holds live on each estimate.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await createOpportunityAction();
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(`/rentals/quotes/${result.id}`);
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {pending ? "Creating…" : "New estimate"}
        </button>
      </header>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative block min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search estimates"
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => pushFilters(f, holdsOnly)}
              className={
                status === f
                  ? "rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-xs font-semibold text-white"
                  : "rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
              }
            >
              {f === "all" ? "All" : AV_OPPORTUNITY_STATUS_LABELS[f]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => pushFilters(status, !holdsOnly)}
            className={
              holdsOnly
                ? "rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
            }
          >
            Gear holds
          </button>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {filtered.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No estimates match this filter. Create one to start building a package —
            or load a sample shop from Overview.
          </li>
        ) : (
          filtered.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
            >
              <Link href={`/rentals/quotes/${r.id}`} className="min-w-0 flex-1">
                <p className="font-medium text-[var(--foreground)]">
                  {r.reference}{" "}
                  <span className="text-[var(--muted)]">·</span> {r.subject}
                </p>
                <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                  {[r.customer_name, r.venue_name].filter(Boolean).join(" · ") ||
                    "No customer / venue"}
                  {" · "}
                  Gear {formatWhen(r.gear_starts_at)}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                {r.hold_count > 0 ? (
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                    {r.hold_count} reserved
                  </span>
                ) : (
                  <span className="text-[var(--muted)]">No gear reserved</span>
                )}
                <span className="rounded-md border border-[var(--border)] px-2 py-0.5">
                  {AV_OPPORTUNITY_STATUS_LABELS[r.status]}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const label = `${r.reference} — ${r.subject || "Untitled"}`;
                    if (
                      !window.confirm(
                        `Delete ${label}?\n\nThis removes the estimate, its lines, and any gear holds. This cannot be undone.`,
                      )
                    ) {
                      return;
                    }
                    startTransition(async () => {
                      setError(null);
                      const result = await deleteOpportunityAction(r.id);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}
