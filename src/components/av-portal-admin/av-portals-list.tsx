"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, ExternalLink, Plus } from "lucide-react";
import { createPortalAction } from "@/app/(app)/av-portals/actions";

export type PortalListRow = {
  id: string;
  eventName: string;
  clientName: string;
  clientEmail: string;
  dateLabel: string;
  daysOut: number;
  venue: string;
  fileNo: string;
  token: string;
  isActive: boolean;
  done: number;
  total: number;
  lastActivity: string | null;
};

const inputCls = "w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm";

export function AvPortalsList({ rows }: { rows: PortalListRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [f, setF] = useState({
    eventName: "",
    clientName: "",
    clientEmail: "",
    ccEmails: "",
    eventDate: "",
    venueName: "",
    loadInTime: "",
    note: "",
    sendNow: true,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  function submit() {
    setErr(null);
    start(async () => {
      const res = await createPortalAction(f);
      if (!res.ok) return setErr(res.error);
      router.push(`/av-portals/${res.data!.id}`);
    });
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`);
      setCopied(token);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  const upcoming = rows.filter((r) => r.daysOut >= 0);
  const past = rows.filter((r) => r.daysOut < 0);

  const renderRow = (r: PortalListRow) => (
    <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <Link href={`/av-portals/${r.id}`} className="font-medium hover:underline">
          {r.eventName}
        </Link>
        <p className="text-xs text-[var(--muted-foreground)]">
          {r.dateLabel}
          {r.daysOut >= 0 ? ` · ${r.daysOut === 0 ? "today" : `${r.daysOut} day${r.daysOut === 1 ? "" : "s"} out`}` : ""}
          {r.venue ? ` · ${r.venue}` : ""} · {r.clientName || r.clientEmail} · {r.fileNo}
        </p>
      </div>
      <div className="flex w-36 items-center gap-2" title={`${r.done} of ${r.total} items received`}>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full bg-[var(--brand)]" style={{ width: `${(r.done / r.total) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums">
          {r.done}/{r.total}
        </span>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          !r.isActive
            ? "bg-gray-200 text-gray-700"
            : r.done === r.total
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
        }`}
      >
        {!r.isActive ? "Paused" : r.done === r.total ? "Ready" : "Waiting on client"}
      </span>
      <button type="button" title="Copy client link" onClick={() => copyLink(r.token)} className="rounded-lg border border-[var(--border)] p-2">
        <Copy className="h-4 w-4" />
        <span className="sr-only">{copied === r.token ? "Copied" : "Copy client link"}</span>
      </button>
      <a href={`/portal/${r.token}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--border)] p-2" title="Open client portal">
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">AV Event Portals</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            One private link per show. Clients send floor plans, run of show, headcount and more; we check in at 30, 14,
            7 and 3 days out.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
        >
          <Plus className="h-4 w-4" /> New event portal
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Event name
              <input className={inputCls} value={f.eventName} onChange={(e) => set("eventName", e.target.value)} />
            </label>
            <label className="text-sm">
              Event date
              <input type="date" className={inputCls} value={f.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
            </label>
            <label className="text-sm">
              Client name
              <input className={inputCls} value={f.clientName} onChange={(e) => set("clientName", e.target.value)} />
            </label>
            <label className="text-sm">
              Client email
              <input type="email" className={inputCls} value={f.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
            </label>
            <label className="text-sm">
              Venue
              <input className={inputCls} value={f.venueName} onChange={(e) => set("venueName", e.target.value)} />
            </label>
            <label className="text-sm">
              Load-in time (optional)
              <input className={inputCls} placeholder="e.g. 7:00 AM" value={f.loadInTime} onChange={(e) => set("loadInTime", e.target.value)} />
            </label>
            <label className="text-sm sm:col-span-2">
              CC emails (optional, comma separated)
              <input className={inputCls} value={f.ccEmails} onChange={(e) => set("ccEmails", e.target.value)} />
            </label>
            <label className="text-sm sm:col-span-2">
              Note to client (optional, shown in the portal and emails)
              <textarea rows={2} className={inputCls} value={f.note} onChange={(e) => set("note", e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.sendNow} onChange={(e) => set("sendNow", e.target.checked)} />
            Send the first check-in email now
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !f.eventName.trim() || !f.clientEmail.trim() || !f.eventDate}
              onClick={submit}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create portal"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Upcoming shows</h2>
        <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {upcoming.length === 0 && <p className="p-5 text-sm text-[var(--muted-foreground)]">No upcoming shows yet.</p>}
          {upcoming.map(renderRow)}
        </div>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Past shows</h2>
          <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
            {past.slice().reverse().map(renderRow)}
          </div>
        </section>
      )}
    </div>
  );
}
