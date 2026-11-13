"use client";

import {
  deleteDraftProjectInvoice,
  downloadProjectInvoicePdf,
  recordProjectInvoicePayment,
  saveProjectInvoice,
  sendProjectInvoice,
  voidProjectInvoice,
} from "@/app/(app)/pipeline/invoice-actions";
import { computeTotals, type PlanKind } from "@/lib/project-invoices/math";
import { DEFAULT_SECTION, groupBySection, moveItem, moveSection, renameSection } from "@/lib/project-invoices/sections";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type InvoiceListItem = {
  id: string;
  number: string;
  title: string;
  status: "draft" | "sent" | "partial" | "paid" | "void";
  total: number;
  amountPaid: number;
  dueAt: string | null;
  taxRatePct: number;
  notes: string;
  payUrl: string;
  lines: { description: string; qty: number; unit_price: number; catalog_item_id: string | null; section: string }[];
  installments: { label: string; amount: number; due_at: string | null; paid: number; overdue: boolean }[];
};
export type CatalogOption = { id: string; name: string; unitPrice: number; category: string };

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const btn = "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-40";
const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm";
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-700",
  sent: "bg-blue-500/15 text-blue-700",
  partial: "bg-amber-500/15 text-amber-700",
  paid: "bg-green-600/15 text-green-700",
  void: "bg-red-500/15 text-red-700",
};

type DraftLine = { description: string; qty: string; unit_price: string; catalog_item_id: string | null; section: string };
const blankLine = (section = ""): DraftLine => ({ description: "", qty: "1", unit_price: "", catalog_item_id: null, section });

export function ProjectInvoices({
  projectId,
  clientEmail,
  eventDate,
  invoices,
  catalog,
  canManage,
}: {
  projectId: string;
  clientEmail: string;
  eventDate: string | null;
  invoices: InvoiceListItem[];
  catalog: CatalogOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  // Editor state
  const [title, setTitle] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<PlanKind>("retainer_balance");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [target, setTarget] = useState("");

  // Payment state
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("check");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState("");

  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({ description: l.description, qty: Number(l.qty) || 0, unit_price: Number(l.unit_price) || 0 })),
        Number(taxRate) || 0,
      ),
    [lines, taxRate],
  );

  const run = (fn: () => Promise<{ error: string | null }>, ok?: string, after?: () => void) =>
    start(async () => {
      setError(null);
      setNotice(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        if (ok) setNotice(ok);
        after?.();
        router.refresh();
      }
    });

  const openNew = () => {
    setEditing("new");
    setTitle("");
    setTaxRate("0");
    setDueAt("");
    setNotes("");
    setPlan("retainer_balance");
    setLines([blankLine()]);
  };
  const openEdit = (inv: InvoiceListItem) => {
    setEditing(inv.id);
    setTitle(inv.title);
    setTaxRate(String(inv.taxRatePct));
    setDueAt(inv.dueAt ?? "");
    setNotes(inv.notes);
    setPlan(inv.installments.length === 1 ? "full" : inv.installments.length === 3 ? "thirds" : "retainer_balance");
    setLines(
      inv.lines.map((l) => ({ description: l.description, qty: String(l.qty), unit_price: String(l.unit_price), catalog_item_id: l.catalog_item_id, section: l.section })),
    );
  };

  const sectionNames = groupBySection(lines.map((l) => ({ ...l, qty: 1, unit_price: 0 }))).map((g) => g.name);
  const categories = useMemo(() => [...new Set(catalog.map((c) => c.category))].sort(), [catalog]);
  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle && !catFilter) return [];
    return catalog
      .filter((c) => (!catFilter || c.category === catFilter) && (!needle || c.name.toLowerCase().includes(needle)))
      .slice(0, 12);
  }, [catalog, search, catFilter]);

  const addFromCatalog = (item: CatalogOption) => {
    const section = target === "" ? item.category : target;
    setLines((cur) => {
      const kept = cur.filter((l) => l.description.trim() || l.unit_price);
      const row: DraftLine = { description: item.name, qty: "1", unit_price: String(item.unitPrice), catalog_item_id: item.id, section };
      // Keep each section's items together: insert after the last line already in that section.
      const last = kept.map((l) => (l.section.trim() || DEFAULT_SECTION).toLowerCase()).lastIndexOf(section.trim().toLowerCase() || DEFAULT_SECTION.toLowerCase());
      if (last === -1) return [...kept, row];
      return [...kept.slice(0, last + 1), row, ...kept.slice(last + 1)];
    });
  };
  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  /** Move a line up or down inside its section. */
  const moveLine = (i: number, delta: -1 | 1) =>
    setLines((c) => {
      const key = (l: DraftLine) => (l.section.trim() || DEFAULT_SECTION).toLowerCase();
      let j = i + delta;
      while (j >= 0 && j < c.length && key(c[j]) !== key(c[i])) j += delta;
      if (j < 0 || j >= c.length) return c;
      const next = c.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const toNum = (l: DraftLine) => ({ ...l, qty: Number(l.qty) || 0, unit_price: Number(l.unit_price) || 0 });
  const withIndex = lines.map((l, idx) => ({ ...toNum(l), idx }));

  const save = () =>
    run(
      async () => {
        const res = await saveProjectInvoice({
          id: editing && editing !== "new" ? editing : undefined,
          projectId,
          title,
          taxRatePct: Number(taxRate) || 0,
          dueAt: dueAt || null,
          notes,
          lines: lines.map((l) => ({ description: l.description, qty: Number(l.qty), unit_price: Number(l.unit_price), catalog_item_id: l.catalog_item_id, section: l.section })),
          plan,
          eventDate,
        });
        return { error: res.error };
      },
      "Invoice saved. Send it when you're ready.",
      () => setEditing(null),
    );

  const send = (inv: InvoiceListItem) => {
    const to = window.prompt("Email this invoice to:", clientEmail);
    if (!to) return;
    run(async () => {
      const res = await sendProjectInvoice({ id: inv.id, to, message: "" });
      return { error: res.error };
    }, `Invoice ${inv.number} emailed to ${to}.`);
  };

  const downloadPdf = (inv: InvoiceListItem, kind: "invoice" | "receipt") =>
    start(async () => {
      setError(null);
      const res = await downloadProjectInvoicePdf(inv.id, kind);
      if (!res.ok) return setError(res.error);
      const bytes = Uint8Array.from(atob(res.pdfBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    });

  const copyLink = async (inv: InvoiceListItem) => {
    try {
      await navigator.clipboard.writeText(inv.payUrl);
      setNotice("Pay link copied.");
    } catch {
      setNotice(inv.payUrl);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Invoices</h2>
        {canManage && editing === null ? (
          <button type="button" className={btn} onClick={openNew}>New invoice</button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
      {notice ? <p className="mt-2 text-sm text-green-700">{notice}</p> : null}

      {invoices.length === 0 && editing === null ? (
        <p className="mt-2 text-sm text-[var(--muted)]">No invoices yet.{canManage ? " Create one to bill this client, with an optional payment plan and a pay-online link." : ""}</p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {invoices.map((inv) => (
          <li key={inv.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{inv.number}</span>
                {inv.title ? <span className="text-[var(--muted)]"> · {inv.title}</span> : null}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
            </div>
            <p className="mt-1">
              {money(inv.total)} total · {money(inv.amountPaid)} paid · <strong>{money(Math.max(0, inv.total - inv.amountPaid))}</strong> due
            </p>
            {inv.installments.length > 1 ? (
              <ul className="mt-1 text-xs text-[var(--muted)]">
                {inv.installments.map((p, i) => (
                  <li key={i} className={p.overdue ? "font-medium text-red-600" : ""}>
                    {p.label}: {money(p.amount)}{p.due_at ? ` due ${p.due_at}` : ""}{p.paid >= p.amount ? " ✓ paid" : p.paid > 0 ? ` (${money(p.paid)} paid)` : p.overdue ? " — overdue" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {canManage && inv.status !== "void" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {inv.status !== "paid" ? <button type="button" className={btn} disabled={pending} onClick={() => send(inv)}>{inv.status === "draft" ? "Send" : "Resend"}</button> : null}
                {inv.status !== "draft" ? <button type="button" className={btn} onClick={() => copyLink(inv)}>Copy pay link</button> : null}
                <button type="button" className={btn} disabled={pending} onClick={() => downloadPdf(inv, "invoice")}>Download invoice PDF</button>
                {inv.amountPaid > 0 ? <button type="button" className={btn} disabled={pending} onClick={() => downloadPdf(inv, "receipt")}>Download receipt PDF</button> : null}
                {inv.status !== "draft" ? <a className={btn} href={inv.payUrl} target="_blank" rel="noreferrer">Preview</a> : null}
                {inv.status !== "paid" ? <button type="button" className={btn} onClick={() => { setPaying(paying === inv.id ? null : inv.id); setPayAmount(String(Math.max(0, inv.total - inv.amountPaid))); }}>Record payment</button> : null}
                {inv.amountPaid === 0 && inv.status !== "paid" ? <button type="button" className={btn} onClick={() => openEdit(inv)}>Edit</button> : null}
                {inv.status === "draft" ? (
                  <button type="button" className={btn} disabled={pending} onClick={() => { if (window.confirm(`Delete draft ${inv.number}?`)) run(() => deleteDraftProjectInvoice(inv.id)); }}>Delete</button>
                ) : (
                  <button type="button" className={btn} disabled={pending} onClick={() => { if (window.confirm(`Void ${inv.number}? The pay link stops working.`)) run(() => voidProjectInvoice(inv.id)); }}>Void</button>
                )}
              </div>
            ) : null}
            {paying === inv.id ? (
              <div className="mt-3 grid gap-2 rounded-lg bg-[var(--background)] p-3 sm:grid-cols-4">
                <label className="text-xs">Amount<input className={input} inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label>
                <label className="text-xs">Method
                  <select className={input} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {["check", "cash", "venmo", "zelle", "card", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="text-xs">Received<input type="date" className={input} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></label>
                <label className="text-xs">Note<input className={input} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Check #1042" /></label>
                <div className="sm:col-span-4">
                  <button
                    type="button"
                    className={btn}
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => recordProjectInvoicePayment({ invoiceId: inv.id, amount: Number(payAmount), method: payMethod, receivedAt: payDate, notes: payNotes }),
                        "Payment recorded.",
                        () => { setPaying(null); setPayNotes(""); },
                      )
                    }
                  >
                    Save payment
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {editing !== null ? (
        <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)] p-3">
          <h3 className="text-sm font-semibold">{editing === "new" ? "New invoice" : "Edit invoice"}</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs sm:col-span-2">Title (optional)<input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wedding production package" /></label>
            <label className="text-xs">Tax rate %<input className={input} inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></label>
          </div>

          <div className="space-y-3">
            {groupBySection(withIndex).map((g, gi, all) => (
              <div key={g.name} className="rounded-lg border border-[var(--border)] p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    key={g.name}
                    className={`${input} max-w-xs font-semibold`}
                    aria-label="Section name"
                    defaultValue={g.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== g.name) setLines((c) => renameSection(c, g.name, v));
                    }}
                  />
                  <span className="text-xs text-[var(--muted)]">{money(g.total)}</span>
                  <button type="button" className={btn} disabled={gi === 0} aria-label="Move section up" onClick={() => setLines((c) => moveSection(c, g.name, -1))}>▲</button>
                  <button type="button" className={btn} disabled={gi === all.length - 1} aria-label="Move section down" onClick={() => setLines((c) => moveSection(c, g.name, 1))}>▼</button>
                </div>
                <div className="mt-2 space-y-2">
                  {g.lines.map((l, li) => (
                    <div key={l.idx} className="grid grid-cols-[1fr_4rem_5.5rem_auto] items-end gap-2">
                      <label className="text-xs"><span className="sr-only">Item</span><input className={input} placeholder="Item" value={lines[l.idx].description} onChange={(e) => setLine(l.idx, { description: e.target.value })} /></label>
                      <label className="text-xs"><span className="sr-only">Qty</span><input className={input} inputMode="decimal" placeholder="Qty" value={lines[l.idx].qty} onChange={(e) => setLine(l.idx, { qty: e.target.value })} /></label>
                      <label className="text-xs"><span className="sr-only">Price</span><input className={input} inputMode="decimal" placeholder="Price" value={lines[l.idx].unit_price} onChange={(e) => setLine(l.idx, { unit_price: e.target.value })} /></label>
                      <div className="flex items-center gap-1">
                        <button type="button" className={btn} disabled={li === 0} aria-label="Move item up" onClick={() => moveLine(l.idx, -1)}>▲</button>
                        <button type="button" className={btn} disabled={li === g.lines.length - 1} aria-label="Move item down" onClick={() => moveLine(l.idx, 1)}>▼</button>
                        <select className={`${input} w-28`} aria-label="Move to section" value="" onChange={(e) => e.target.value && setLine(l.idx, { section: e.target.value })}>
                          <option value="">Move to…</option>
                          {sectionNames.filter((n) => n !== g.name).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button type="button" className={btn} aria-label="Remove line" onClick={() => setLines((c) => (c.length > 1 ? c.filter((_, j) => j !== l.idx) : [blankLine()]))}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className={`${btn} mt-2`} onClick={() => setLines((c) => [...c, blankLine(g.name === DEFAULT_SECTION ? "" : g.name)])}>+ Add blank item here</button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={btn} onClick={() => setLines((c) => [...c, blankLine(`Section ${sectionNames.length + 1}`)])}>+ Add section</button>
            </div>

            {catalog.length ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-2">
                <p className="text-xs font-medium">Find an item to add</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input className={`${input} max-w-xs`} placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <select className={`${input} max-w-[12rem]`} aria-label="Item category" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                    <option value="">All categories</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className={`${input} max-w-[12rem]`} aria-label="Add to section" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">Section: item&apos;s category</option>
                    {sectionNames.map((n) => <option key={n} value={n}>Section: {n}</option>)}
                  </select>
                </div>
                {matches.length ? (
                  <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
                    {matches.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 py-1">
                        <span>{c.name} <span className="text-xs text-[var(--muted)]">{c.category} · {money(c.unitPrice)}</span></span>
                        <button type="button" className={btn} onClick={() => addFromCatalog(c)}>Add</button>
                      </li>
                    ))}
                  </ul>
                ) : search.trim() || catFilter ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">Nothing matches.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Payment plan
              <select className={input} value={plan} onChange={(e) => setPlan(e.target.value as PlanKind)}>
                <option value="retainer_balance">50% retainer, balance before the event</option>
                <option value="full">Pay in full</option>
                <option value="thirds">Three equal payments, 30 days apart</option>
              </select>
            </label>
            <label className="text-xs">Overall due date (optional)<input type="date" className={input} value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label>
          </div>
          <label className="block text-xs">Notes to the client<textarea className={input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

          <p className="text-sm">
            Subtotal {money(totals.subtotal)}{totals.tax > 0 ? ` · Tax ${money(totals.tax)}` : ""} · <strong>Total {money(totals.total)}</strong>
          </p>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-[var(--accent,#2563eb)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={pending} onClick={save}>Save invoice</button>
            <button type="button" className={btn} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
