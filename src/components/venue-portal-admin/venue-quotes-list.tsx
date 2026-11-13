"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, ExternalLink, Inbox, Plus } from "lucide-react";
import {
  createPortalAction,
  createPortalWithStarterCatalogAction,
  duplicatePortalAction,
} from "@/app/(app)/venue-quotes/actions";

export type PortalListRow = {
  id: string;
  slug: string;
  name: string;
  isPublished: boolean;
  total: number;
  fresh: number;
};

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm";

export function VenueQuotesList({ rows }: { rows: PortalListRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<
    null | { kind: "new" } | { kind: "starter" } | { kind: "dup"; id: string; from: string }
  >(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    start(async () => {
      const res =
        mode?.kind === "dup"
          ? await duplicatePortalAction({ sourceId: mode.id, name, slug })
          : mode?.kind === "starter"
            ? await createPortalWithStarterCatalogAction({ name, slug })
            : await createPortalAction({ name, slug });
      if (!res.ok) return setErr(res.error);
      router.push(`/venue-quotes/${res.data!.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Venue Quotes</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Public instant-quote pages, one per venue. Share the link; no login needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/venue-quotes/requests"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            <Inbox className="h-4 w-4" /> Requests
          </Link>
          <button
            type="button"
            onClick={() => {
              setMode({ kind: "starter" });
              setName("Sample Meeting Center");
              setSlug("ponte-vedra-meeting-center");
              setErr(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Starter catalog
          </button>
          <button
            type="button"
            onClick={() => { setMode({ kind: "new" }); setName(""); setSlug(""); setErr(null); }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <Plus className="h-4 w-4" /> New venue
          </button>
        </div>
      </div>

      {mode && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm font-medium">
            {mode.kind === "dup"
              ? `Duplicate “${mode.from}”`
              : mode.kind === "starter"
                ? "New venue with starter AV catalog"
                : "New venue"}
          </p>
          {mode.kind === "starter" ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              Creates spaces, a Complete Meeting package, add-ons, and technicians.
              Edit pricing, then Publish — share{" "}
              <code className="text-[var(--foreground)]">/quote/{slug || "…"}</code>.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Venue name
              <input className={inputCls} value={name} onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
              }} />
            </label>
            <label className="text-sm">
              Link name
              <input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} />
              <span className="text-xs text-[var(--muted-foreground)]">/quote/{slug || "…"}</span>
            </label>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={pending || !name.trim()} onClick={submit}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50">
              {pending ? "Creating…" : mode.kind === "dup" ? "Duplicate" : "Create"}
            </button>
            <button type="button" onClick={() => setMode(null)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
        {rows.length === 0 && <p className="p-5 text-sm text-[var(--muted-foreground)]">No venues yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Link href={`/venue-quotes/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
              <p className="text-xs text-[var(--muted-foreground)]">
                /quote/{r.slug} · {r.total} request{r.total === 1 ? "" : "s"}
                {r.fresh > 0 ? ` (${r.fresh} new)` : ""}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${r.isPublished ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {r.isPublished ? "Published" : "Draft"}
            </span>
            <a href={`/quote/${r.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--border)] p-2" title="Open page">
              <ExternalLink className="h-4 w-4" />
            </a>
            <button type="button" title="Duplicate" className="rounded-lg border border-[var(--border)] p-2"
              onClick={() => { setMode({ kind: "dup", id: r.id, from: r.name }); setName(""); setSlug(""); setErr(null); }}>
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
