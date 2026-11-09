"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  deleteChildAction,
  deletePortalAction,
  moveChildAction,
  saveAddonAction,
  saveEnhancementAction,
  savePackageAction,
  savePortalAction,
  saveSpaceAction,
  saveTechnicianAction,
  setPublishedAction,
  type ActionResult,
  type ChildTable,
} from "@/app/(app)/venue-quotes/actions";
import { ImageField } from "./image-field";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm";
const btn = "rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs";
const primary =
  "rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{hint}</span>}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Generic list editor: each row has its own Save / Delete / reorder. */
function RowList({
  portalId, table, rows, blank, save, render, title,
}: {
  portalId: string;
  table: ChildTable;
  rows: Row[];
  blank: Row;
  save: (portalId: string, row: any) => Promise<ActionResult<{ id: string }>>;
  render: (row: Row, set: (patch: Row) => void) => React.ReactNode;
  title: (row: Row) => string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Row[]>(rows);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const patch = (key: string, p: Row) =>
    setLocal((ls) => ls.map((r) => ((r.id ?? "__new") === key ? { ...r, ...p } : r)));

  function doSave(row: Row) {
    const key = row.id ?? "__new";
    start(async () => {
      const res = await save(portalId, row);
      if (!res.ok) return setMsg((m) => ({ ...m, [key]: res.error }));
      setMsg((m) => ({ ...m, [key]: "Saved" }));
      if (!row.id) {
        const newId = res.data?.id;
        setLocal((ls) => ls.map((r) => (r.id ? r : { ...row, id: newId })));
        setAdding(false);
      }
      router.refresh();
    });
  }
  function doDelete(row: Row) {
    if (!row.id) { setLocal((ls) => ls.filter((r) => r.id)); setAdding(false); return; }
    if (!confirm(`Delete “${row.name || "this item"}”?`)) return;
    start(async () => {
      const res = await deleteChildAction(table, portalId, row.id);
      if (!res.ok) return setMsg((m) => ({ ...m, [row.id]: res.error }));
      setLocal((ls) => ls.filter((r) => r.id !== row.id));
      router.refresh();
    });
  }
  function doMove(row: Row, dir: "up" | "down") {
    start(async () => {
      await moveChildAction(table, portalId, row.id, dir);
      setLocal((ls) => {
        const i = ls.findIndex((r) => r.id === row.id);
        const j = dir === "up" ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= ls.length) return ls;
        const c = [...ls];
        [c[i], c[j]] = [c[j], c[i]];
        return c;
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {local.map((row, idx) => {
        const key = row.id ?? "__new";
        return (
          <div key={key} className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{title(row) || "New item"}{row.is_active === false ? " (hidden)" : ""}</p>
              <div className="flex items-center gap-1">
                {row.id && (
                  <>
                    <button type="button" disabled={idx === 0 || pending} className={btn} onClick={() => doMove(row, "up")} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={idx === local.length - 1 || pending} className={btn} onClick={() => doMove(row, "down")} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </>
                )}
                <button type="button" className={btn} onClick={() => doDelete(row)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {render(row, (p) => patch(key, p))}
            <div className="flex items-center gap-3">
              <button type="button" disabled={pending} className={primary} onClick={() => doSave(row)}>Save</button>
              {msg[key] && <span className={`text-xs ${msg[key] === "Saved" ? "text-emerald-600" : "text-red-600"}`}>{msg[key]}</span>}
            </div>
          </div>
        );
      })}
      {!adding && (
        <button type="button" className={`${btn} inline-flex items-center gap-1`}
          onClick={() => { setLocal((ls) => [...ls, { ...blank }]); setAdding(true); }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      )}
    </div>
  );
}

export function VenuePortalEditor({
  portal, spaces, packages, addons, enhancements, technicians, techTablesMissing, hasCoordinatorPassword,
  catalogProducts = [], catalogServices = [],
}: {
  portal: Row;
  spaces: Row[];
  packages: Row[];
  addons: Row[];
  enhancements: Row[];
  technicians: Row[];
  techTablesMissing: boolean;
  hasCoordinatorPassword: boolean;
  catalogProducts?: { id: string; label: string }[];
  catalogServices?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    name: portal.name as string,
    slug: portal.slug as string,
    headline: (portal.headline ?? "") as string,
    intro: (portal.intro ?? "") as string,
    hero_image_url: (portal.hero_image_url ?? null) as string | null,
    logo_url: (portal.logo_url ?? null) as string | null,
    accent_color: (portal.accent_color ?? "#b08a4a") as string,
    event_types: ((portal.event_types ?? []) as string[]).join(", "),
    default_start_time: String(portal.default_start_time ?? "18:00").slice(0, 5),
    default_end_time: String(portal.default_end_time ?? "22:00").slice(0, 5),
    delivery_fee: String(portal.delivery_fee ?? 0),
    tech_hourly_rate: String(portal.tech_hourly_rate ?? 0),
    savings_label: (portal.savings_label ?? "") as string,
    savings_pct: String(portal.savings_pct ?? 0),
    deposit_pct: String(portal.deposit_pct ?? 50),
    notify_email: (portal.notify_email ?? "") as string,
  });
  const [coordPw, setCoordPw] = useState("");
  const [clearPw, setClearPw] = useState(false);
  const [published, setPublished] = useState(!!portal.is_published);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  const id = portal.id as string;

  function saveSettings() {
    setMsg(null);
    start(async () => {
      const res = await savePortalAction(id, {
        ...f,
        event_types: f.event_types.split(","),
        delivery_fee: Number(f.delivery_fee),
        tech_hourly_rate: Number(f.tech_hourly_rate),
        savings_pct: Number(f.savings_pct),
        deposit_pct: Number(f.deposit_pct),
        coordinator_password: coordPw,
        clear_coordinator_password: clearPw,
      });
      setMsg(res.ok ? "Saved" : res.error);
      if (res.ok) {
        setCoordPw("");
        setClearPw(false);
        router.refresh();
      }
    });
  }
  function togglePublish() {
    start(async () => {
      const res = await setPublishedAction(id, !published);
      if (res.ok) setPublished(!published);
      else setMsg(res.error);
    });
  }
  function remove() {
    if (!confirm(`Delete ${f.name}? This removes its packages, add-ons and spaces.`)) return;
    start(async () => {
      const res = await deletePortalAction(id);
      if (res.ok) router.push("/venue-quotes");
      else setMsg(res.error);
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-16">
      <Link href="/venue-quotes" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
        <ArrowLeft className="h-4 w-4" /> All venues
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{f.name}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{origin}/quote/{portal.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/quote/${portal.slug}`} target="_blank" rel="noreferrer" className={`${btn} inline-flex items-center gap-1`}>
            <ExternalLink className="h-3.5 w-3.5" /> {published ? "Open page" : "Preview"}
          </a>
          <button type="button" disabled={pending} onClick={togglePublish}
            className={published ? btn : primary}>
            {published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>
      {!published && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Draft: only admins can see this page (submissions in preview are saved but send no emails). Publish when ready.
        </p>
      )}

      <Section title="Venue & rates">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Venue name"><input className={input} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Link name" hint="Changing this breaks links already shared."><input className={input} value={f.slug} onChange={(e) => set({ slug: e.target.value })} /></Field>
          <Field label="Headline"><input className={input} value={f.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
          <Field label="Accent color"><input className={input} value={f.accent_color} onChange={(e) => set({ accent_color: e.target.value })} /></Field>
        </div>
        <Field label="Intro text"><textarea rows={3} className={input} value={f.intro} onChange={(e) => set({ intro: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <ImageField label="Hero image" value={f.hero_image_url} onChange={(u) => set({ hero_image_url: u })} folder={`${id}/hero`} />
          <ImageField label="Logo" value={f.logo_url} onChange={(u) => set({ logo_url: u })} folder={`${id}/logo`} />
        </div>
        <Field label="Event types" hint="Comma separated, e.g. Corporate, Wedding, Gala">
          <input className={input} value={f.event_types} onChange={(e) => set({ event_types: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Default start"><input type="time" className={input} value={f.default_start_time} onChange={(e) => set({ default_start_time: e.target.value })} /></Field>
          <Field label="Default end"><input type="time" className={input} value={f.default_end_time} onChange={(e) => set({ default_end_time: e.target.value })} /></Field>
          <Field label="Delivery fee ($, once)"><input type="number" min="0" className={input} value={f.delivery_fee} onChange={(e) => set({ delivery_fee: e.target.value })} /></Field>
          <Field label="Fallback technician rate ($/hr)" hint="Only used by packages with no technician roles linked."><input type="number" min="0" className={input} value={f.tech_hourly_rate} onChange={(e) => set({ tech_hourly_rate: e.target.value })} /></Field>
          <Field label="Savings label"><input className={input} value={f.savings_label} onChange={(e) => set({ savings_label: e.target.value })} /></Field>
          <Field label="Savings % (equipment)"><input type="number" min="0" max="100" className={input} value={f.savings_pct} onChange={(e) => set({ savings_pct: e.target.value })} /></Field>
          <Field label="Book Now deposit %" hint="Percent of the estimated (post-discount) total collected via Stripe when the guest presses Book Now.">
            <input type="number" min="0" max="100" className={input} value={f.deposit_pct} onChange={(e) => set({ deposit_pct: e.target.value })} />
          </Field>
        </div>
        <Field
          label={hasCoordinatorPassword ? "Coordinator password (set)" : "Coordinator password (not set)"}
          hint="Venue coordinators must enter this before they see the savings above. Clients never see the savings. If no password is set, the savings are not offered to anyone. Leave blank to keep the current one."
        >
          <input type="text" autoComplete="off" className={input} value={coordPw} onChange={(e) => setCoordPw(e.target.value)} placeholder={hasCoordinatorPassword ? "Type a new password to replace it" : "Choose a password (6+ characters)"} />
        </Field>
        {hasCoordinatorPassword && <Check label="Remove the coordinator password (turns the savings off)" checked={clearPw} onChange={setClearPw} />}
        <Field label="Send new requests to" hint="Blank uses the default Vident inbox.">
          <input type="email" className={input} value={f.notify_email} onChange={(e) => set({ notify_email: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <button type="button" disabled={pending} onClick={saveSettings} className={primary}>Save settings</button>
          {msg && <span className={`text-xs ${msg === "Saved" ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>}
        </div>
      </Section>

      <Section title="Spaces" hint="Rooms the client can pick. “Custom quote” spaces show no price.">
        <RowList portalId={id} table="venue_portal_spaces" rows={spaces} save={saveSpaceAction}
          blank={{ name: "", image_url: null, capacity: null, is_custom_quote: false, is_active: true }}
          title={(r) => r.name}
          render={(r, s) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><input className={input} value={r.name} onChange={(e) => s({ name: e.target.value })} /></Field>
              <Field label="Capacity"><input type="number" min="0" className={input} value={r.capacity ?? ""} onChange={(e) => s({ capacity: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <ImageField label="Photo" value={r.image_url} onChange={(u) => s({ image_url: u })} folder={`${id}/spaces`} />
              <div className="space-y-2 pt-5">
                <Check label="Custom quote only" checked={!!r.is_custom_quote} onChange={(v) => s({ is_custom_quote: v })} />
                <Check label="Shown on page" checked={r.is_active !== false} onChange={(v) => s({ is_active: v })} />
              </div>
            </div>
          )} />
      </Section>

      <Section title="Technicians" hint="Roles like Audio Technician or Video Technician. Each is billed hourly (rate × event hours) or daily (rate × event days) for every space whose package includes it. Link them to packages below.">
        {techTablesMissing ? (
          <p className="text-sm text-amber-700">Run migration 137_venue_portal_technicians.sql in Supabase to enable technician roles.</p>
        ) : (
          <RowList portalId={id} table="venue_portal_technicians" rows={technicians} save={saveTechnicianAction}
            blank={{ name: "", rate_type: "hourly", rate: 0, is_active: true }}
            title={(r) => r.name}
            render={(r, s) => (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name"><input className={input} value={r.name} onChange={(e) => s({ name: e.target.value })} placeholder="Audio Technician" /></Field>
                <Field label="Billed">
                  <select className={input} value={r.rate_type} onChange={(e) => s({ rate_type: e.target.value })}>
                    <option value="hourly">per hour</option>
                    <option value="daily">per day</option>
                  </select>
                </Field>
                <Field label={r.rate_type === "daily" ? "Day rate ($)" : "Hourly rate ($)"}><input type="number" min="0" step="0.01" className={input} value={r.rate} onChange={(e) => s({ rate: e.target.value })} /></Field>
                <div className="sm:col-span-3"><Check label="Billable" checked={r.is_active !== false} onChange={(v) => s({ is_active: v })} /></div>
              </div>
            )} />
        )}
        <p className="text-xs text-[var(--muted-foreground)]">After adding or changing roles, reload this page so the package checkboxes below list them.</p>
      </Section>

      <Section title="Packages" hint="Package price, setup fee, technician roles, and optional Hub catalog product/service for Create Hub quote.">
        <RowList portalId={id} table="venue_portal_packages" rows={packages} save={savePackageAction}
          blank={{ name: "", tagline: "", price: 0, setup_fee: 0, includes_technician: false, is_popular: false, is_active: true, items: [], technician_ids: [], av_product_id: null, av_service_id: null }}
          title={(r) => r.name}
          render={(r, s) => (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name"><input className={input} value={r.name} onChange={(e) => s({ name: e.target.value })} /></Field>
                <Field label="Tagline"><input className={input} value={r.tagline} onChange={(e) => s({ tagline: e.target.value })} /></Field>
                <Field label="Price ($)"><input type="number" min="0" className={input} value={r.price} onChange={(e) => s({ price: e.target.value })} /></Field>
                <Field label="Setup fee ($)"><input type="number" min="0" className={input} value={r.setup_fee} onChange={(e) => s({ setup_fee: e.target.value })} /></Field>
                <Field label="Hub catalog product" hint="Used when creating a Hub quote from a request. Product wins over service.">
                  <select
                    className={input}
                    value={r.av_product_id ?? ""}
                    onChange={(e) =>
                      s({
                        av_product_id: e.target.value || null,
                        av_service_id: e.target.value ? null : r.av_service_id,
                      })
                    }
                  >
                    <option value="">None (free-text line)</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Hub catalog service" hint="Only used when no product is selected.">
                  <select
                    className={input}
                    value={r.av_service_id ?? ""}
                    disabled={!!r.av_product_id}
                    onChange={(e) => s({ av_service_id: e.target.value || null })}
                  >
                    <option value="">None</option>
                    {catalogServices.map((sv) => (
                      <option key={sv.id} value={sv.id}>{sv.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              {technicians.length > 0 && (
                <div className="space-y-1">
                  <span className="block text-sm">Technicians included</span>
                  <div className="flex flex-wrap gap-4">
                    {technicians.map((t) => (
                      <Check key={t.id} label={`${t.name} (${t.rate_type === "daily" ? "daily" : "hourly"})`}
                        checked={(r.technician_ids as string[]).includes(t.id)}
                        onChange={(v) => s({ technician_ids: v ? [...(r.technician_ids as string[]), t.id] : (r.technician_ids as string[]).filter((x) => x !== t.id) })} />
                    ))}
                  </div>
                </div>
              )}
              <Field label="What's included" hint="One item per line">
                <textarea rows={4} className={input} value={(r.items as string[]).join("\n")} onChange={(e) => s({ items: e.target.value.split("\n") })} />
              </Field>
              <div className="flex flex-wrap gap-4">
                {technicians.length === 0 && (
                  <Check label="Technician included (uses the venue's single hourly rate)" checked={!!r.includes_technician} onChange={(v) => s({ includes_technician: v })} />
                )}
                <Check label="Most popular badge" checked={!!r.is_popular} onChange={(v) => s({ is_popular: v })} />
                <Check label="Shown on page" checked={r.is_active !== false} onChange={(v) => s({ is_active: v })} />
              </div>
            </div>
          )} />
      </Section>

      <Section title="À la carte add-ons" hint="Unit price is per item (each), a flat fee, or per hour. Map to a Hub catalog product/service so Create Hub quote carries the link.">
        <RowList portalId={id} table="venue_portal_addons" rows={addons} save={saveAddonAction}
          blank={{ name: "", description: "", image_url: null, unit_price: 0, price_unit: "each", min_quantity: 0, max_quantity: null, is_orderable: true, note: "", is_active: true, av_product_id: null, av_service_id: null }}
          title={(r) => r.name}
          render={(r, s) => (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name"><input className={input} value={r.name} onChange={(e) => s({ name: e.target.value })} /></Field>
                <Field label="Description"><input className={input} value={r.description} onChange={(e) => s({ description: e.target.value })} /></Field>
                <Field label="Price ($)"><input type="number" min="0" step="0.01" className={input} value={r.unit_price} onChange={(e) => s({ unit_price: e.target.value })} /></Field>
                <Field label="Priced">
                  <select className={input} value={r.price_unit} onChange={(e) => s({ price_unit: e.target.value })}>
                    <option value="each">per item</option>
                    <option value="flat">flat fee</option>
                    <option value="hour">per hour</option>
                  </select>
                </Field>
                <Field label="Minimum quantity (hours for hourly)"><input type="number" min="0" className={input} value={r.min_quantity} onChange={(e) => s({ min_quantity: e.target.value })} /></Field>
                <Field label="Maximum quantity" hint="Blank = no limit"><input type="number" min="1" className={input} value={r.max_quantity ?? ""} onChange={(e) => s({ max_quantity: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Note shown to client"><input className={input} value={r.note} onChange={(e) => s({ note: e.target.value })} /></Field>
                <ImageField label="Photo" value={r.image_url} onChange={(u) => s({ image_url: u })} folder={`${id}/addons`} />
                <Field label="Hub catalog product">
                  <select
                    className={input}
                    value={r.av_product_id ?? ""}
                    onChange={(e) =>
                      s({
                        av_product_id: e.target.value || null,
                        av_service_id: e.target.value ? null : r.av_service_id,
                      })
                    }
                  >
                    <option value="">None (free-text line)</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Hub catalog service">
                  <select
                    className={input}
                    value={r.av_service_id ?? ""}
                    disabled={!!r.av_product_id}
                    onChange={(e) => s({ av_service_id: e.target.value || null })}
                  >
                    <option value="">None</option>
                    {catalogServices.map((sv) => (
                      <option key={sv.id} value={sv.id}>{sv.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-4">
                <Check label="Orderable" checked={r.is_orderable !== false} onChange={(v) => s({ is_orderable: v })} />
                <Check label="Shown on page" checked={r.is_active !== false} onChange={(v) => s({ is_active: v })} />
              </div>
            </div>
          )} />
      </Section>

      <Section title="Enhancement cards" hint="Optional extras the client can say they're interested in (no price).">
        <RowList portalId={id} table="venue_portal_enhancements" rows={enhancements} save={saveEnhancementAction}
          blank={{ name: "", description: "", image_url: null, is_active: true }}
          title={(r) => r.name}
          render={(r, s) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><input className={input} value={r.name} onChange={(e) => s({ name: e.target.value })} /></Field>
              <Field label="Description"><input className={input} value={r.description} onChange={(e) => s({ description: e.target.value })} /></Field>
              <ImageField label="Photo" value={r.image_url} onChange={(u) => s({ image_url: u })} folder={`${id}/enhancements`} />
              <div className="pt-5"><Check label="Shown on page" checked={r.is_active !== false} onChange={(v) => s({ is_active: v })} /></div>
            </div>
          )} />
      </Section>

      <div className="flex justify-end">
        <button type="button" disabled={pending} onClick={remove} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700">
          <Trash2 className="h-3.5 w-3.5" /> Delete venue
        </button>
      </div>
    </div>
  );
}
