"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/components/layout/sidebar";
import {
  PAGE_GROUP_ORDER,
  PAGE_REGISTRY,
  type PageAudience,
  type PageEntry,
} from "@/lib/page-map/registry";

type Filter = "all" | "nav" | "reachable" | "redirect";

type Row = PageEntry & {
  inNav: boolean;
  audienceLabel: string;
  isAdminOnly: boolean;
  isPublic: boolean;
};

const AUDIENCE_LABEL: Record<PageAudience, string> = {
  all: "Everyone",
  staff: "All staff",
  admin: "Admin",
  trainer: "Admin & trainers",
  av: "AV & admin",
};

function navAudience(item: NavItem): { label: string; admin: boolean } {
  if (item.adminOnly) return { label: "Admin", admin: true };
  if (item.marketerAccess) return { label: "Admin & trainers", admin: false };
  if (item.avAccess) return { label: "AV & admin", admin: false };
  return { label: "All staff", admin: false };
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "nav", label: "Linked in nav" },
  { id: "reachable", label: "Reachable" },
  { id: "redirect", label: "Redirects" },
];

export function PageMapClient() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows: Row[] = useMemo(() => {
    const navByHref = new Map<string, NavItem>();
    for (const g of NAV_GROUPS) for (const i of g.items) navByHref.set(i.href, i);
    return PAGE_REGISTRY.map((entry) => {
      const navItem = navByHref.get(entry.path);
      const inNav = Boolean(navItem);
      const aud = navItem
        ? navAudience(navItem)
        : {
            label: entry.audience ? AUDIENCE_LABEL[entry.audience] : "",
            admin: entry.audience === "admin",
          };
      return {
        ...entry,
        inNav,
        audienceLabel: entry.kind === "public" ? "Public / token" : aud.label,
        isAdminOnly: aud.admin,
        isPublic: entry.kind === "public",
      };
    });
  }, []);

  const stats = useMemo(
    () => ({
      total: rows.length,
      nav: rows.filter((r) => r.inNav).length,
      reachable: rows.filter((r) => !r.inNav && r.kind === "reachable").length,
      pub: rows.filter((r) => r.isPublic).length,
      admin: rows.filter((r) => r.isAdminOnly).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "nav" && !r.inNav) return false;
      if (filter === "reachable" && (r.inNav || r.kind !== "reachable")) return false;
      if (filter === "redirect" && r.kind !== "redirect") return false;
      if (!q) return true;
      return (
        r.label.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  const grouped = PAGE_GROUP_ORDER.map((group) => ({
    group,
    rows: visible.filter((r) => r.group === group),
  })).filter((g) => g.rows.length > 0);

  const tiles = [
    { label: "Total pages", value: stats.total },
    { label: "Linked in nav", value: stats.nav },
    { label: "Reachable", value: stats.reachable },
    { label: "Public / token", value: stats.pub },
    { label: "Admin only", value: stats.admin },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Page Map</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every page in the hub, who can open it, and how people get there.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="text-2xl font-semibold">{t.value}</div>
            <div className="text-xs text-[var(--muted)]">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, paths, or notes"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                filter === f.id
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No pages match.</p>
      ) : (
        grouped.map(({ group, rows: groupRows }) => (
          <section key={group} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {group} <span className="font-normal">({groupRows.length})</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {groupRows.map((r) => (
                <div
                  key={r.path}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{r.label}</div>
                    {!r.path.includes("[") && r.kind !== "redirect" ? (
                      <Link
                        href={r.path}
                        className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.audienceLabel ? <Badge>{r.audienceLabel}</Badge> : null}
                    {r.inNav ? <Badge tone="brand">Linked in nav</Badge> : null}
                    {!r.inNav && r.kind === "reachable" ? <Badge>Reachable</Badge> : null}
                    {r.kind === "redirect" ? <Badge>Redirect</Badge> : null}
                  </div>
                  <code className="mt-2 block text-xs text-[var(--muted)]">{r.path}</code>
                  {r.note ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">{r.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "brand";
}) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        tone === "brand"
          ? "border-[var(--brand)] text-[var(--brand)]"
          : "border-[var(--border)] text-[var(--muted)]"
      }`}
    >
      {children}
    </span>
  );
}
