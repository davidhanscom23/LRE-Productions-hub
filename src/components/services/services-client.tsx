"use client";

import {
  addCategoryAction,
  deleteCategoryAction,
  renameCategoryAction,
  saveServiceAction,
} from "@/app/(app)/services/actions";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type ServiceRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  unit_price: number;
  active: boolean;
};

const field =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--foreground)]";
const btn =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium disabled:opacity-40";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

type Draft = { id?: string; name: string; description: string; category: string; price: string; active: boolean };
const blank: Draft = { name: "", description: "", category: "Other", price: "0", active: true };

const NEW_CATEGORY = "__new__";

export function ServicesClient({
  rows,
  categories,
  customCategories,
  canEdit,
}: {
  rows: ServiceRow[];
  categories: string[];
  customCategories: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showCats, setShowCats] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const countFor = (c: string) => rows.filter((r) => r.category === c).length;

  const catAction = (fn: () => Promise<{ error: string | null }>, done: string) =>
    start(async () => {
      const res = await fn();
      setMsg(res.error ?? done);
      if (!res.error) {
        setNewCat("");
        setRenaming(null);
        router.refresh();
      }
    });

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (showArchived || r.active) &&
        (!cat || r.category === cat) &&
        (!needle || r.name.toLowerCase().includes(needle) || r.description.toLowerCase().includes(needle)),
    );
  }, [rows, q, cat, showArchived]);

  const save = () =>
    start(async () => {
      if (!draft) return;
      const res = await saveServiceAction({
        id: draft.id,
        name: draft.name,
        description: draft.description,
        category: draft.category,
        unitPrice: Number(draft.price),
        active: draft.active,
      });
      if (res.error) setMsg(res.error);
      else {
        setMsg("Saved.");
        setDraft(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${field} min-w-[12rem] flex-1`} placeholder="Search services" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={field} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        {canEdit && (
          <>
            <button className={btn} onClick={() => setDraft({ ...blank })}>+ Add service</button>
            <button className={btn} onClick={() => setShowCats((v) => !v)}>Categories</button>
          </>
        )}
      </div>
      {msg && <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">{msg}</p>}

      {showCats && canEdit && (
        <section className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold">Item categories</h2>
          <p className="text-xs text-[var(--muted)]">
            Add your own (for example DMC categories). Built-in ones can&apos;t be renamed or deleted, and a category can only be deleted when no item uses it.
          </p>
          <div className="flex gap-2">
            <input className={`${field} flex-1`} placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button className={btn} disabled={pending || !newCat.trim()} onClick={() => catAction(() => addCategoryAction(newCat), "Category added.")}>
              Add
            </button>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {categories.map((c) => {
              const custom = customCategories.includes(c);
              return (
                <li key={c} className="flex items-center gap-2">
                  {renaming?.from === c ? (
                    <>
                      <input className={`${field} flex-1`} value={renaming.to} onChange={(e) => setRenaming({ from: c, to: e.target.value })} />
                      <button className={btn} disabled={pending} onClick={() => catAction(() => renameCategoryAction(c, renaming.to), "Category renamed.")}>
                        Save
                      </button>
                      <button className={btn} onClick={() => setRenaming(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1">
                        {c} <span className="text-xs text-[var(--muted)]">({countFor(c)})</span>
                      </span>
                      {custom && (
                        <>
                          <button className={btn} onClick={() => setRenaming({ from: c, to: c })}>Rename</button>
                          <button className={btn} disabled={pending || countFor(c) > 0} onClick={() => catAction(() => deleteCategoryAction(c), "Category deleted.")}>
                            Delete
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {draft && (
        <section className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold">{draft.id ? "Edit service" : "New service"}</h2>
          <input className={field} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <textarea className={field} placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <select
              className={field}
              value={draft.category}
              onChange={(e) => {
                if (e.target.value !== NEW_CATEGORY) return setDraft({ ...draft, category: e.target.value });
                const name = window.prompt("Name for the new category")?.trim();
                if (name) setDraft({ ...draft, category: name.slice(0, 60) });
              }}
            >
              {[...new Set([...categories, draft.category])].map((c) => (
                <option key={c}>{c}</option>
              ))}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              Price $
              <input className={`${field} w-28`} type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={save} disabled={pending || !draft.name.trim()}>{pending ? "Saving…" : "Save"}</button>
            <button className={btn} onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </section>
      )}

      <p className="text-xs text-[var(--muted)]">{shown.length} of {rows.length} services</p>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={`border-t border-[var(--border)] ${r.active ? "" : "opacity-50"}`}>
                <td className="px-3 py-1.5">
                  {r.name}
                  {!r.active && <span className="ml-2 text-xs text-[var(--muted)]">archived</span>}
                  {r.description && <p className="text-xs text-[var(--muted)]">{r.description}</p>}
                </td>
                <td className="px-3 py-1.5 text-xs">{r.category}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.unit_price)}</td>
                {canEdit && (
                  <td className="px-3 py-1.5 text-right">
                    <button
                      className={btn}
                      onClick={() => setDraft({ id: r.id, name: r.name, description: r.description, category: r.category, price: String(r.unit_price), active: r.active })}
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                  {rows.length === 0 ? "The catalog is empty. Admins and Leads can add services with + Add service." : "No services match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
