"use client";

import { useState, useTransition } from "react";
import { saveHubLinkAction, setHubAccessAction } from "@/app/(app)/hub-switcher/actions";

export type AdminHub = { slug: string; name: string; url: string; logo_url: string; enabled: boolean };
export type AdminPerson = { id: string; name: string; role: string; isOwner?: boolean };

export function HubAccessAdmin({
  hubs,
  people,
  access,
}: {
  hubs: AdminHub[];
  people: AdminPerson[];
  access: string[]; // "slug:profileId"
}) {
  const [granted, setGranted] = useState(() => new Set(access));
  const [drafts, setDrafts] = useState(() => Object.fromEntries(hubs.map((h) => [h.slug, h])));
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [, start] = useTransition();
  const [query, setQuery] = useState("");

  const toggle = (slug: string, id: string, allowed: boolean) => {
    const key = `${slug}:${id}`;
    setGranted((prev) => {
      const next = new Set(prev);
      if (allowed) next.add(key);
      else next.delete(key);
      return next;
    });
    start(async () => {
      const r = await setHubAccessAction({ slug, profileId: id, allowed });
      if (r.error) {
        setMsg((m) => ({ ...m, access: r.error! }));
        setGranted((prev) => {
          const next = new Set(prev);
          if (allowed) next.delete(key);
          else next.add(key);
          return next;
        });
      } else setMsg((m) => ({ ...m, access: "" }));
    });
  };

  const save = (slug: string) =>
    start(async () => {
      const d = drafts[slug];
      const r = await saveHubLinkAction({ slug, name: d.name, url: d.url, logoUrl: d.logo_url, enabled: d.enabled });
      setMsg((m) => ({ ...m, [slug]: r.error ?? "Saved." }));
    });

  const shown = people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const input = "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">Hubs in the switcher</h2>
        <p className="text-xs text-[var(--muted)]">
          Leave the link empty to show a tile as Coming soon. Logos load from /hub-logos/&lt;hub&gt;.png (and -dark.png in dark mode) unless you enter a logo link.
        </p>
        {hubs.map((h) => {
          const d = drafts[h.slug];
          const set = (patch: Partial<AdminHub>) => setDrafts((p) => ({ ...p, [h.slug]: { ...p[h.slug], ...patch } }));
          return (
            <div key={h.slug} className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-[1fr_1.5fr_1fr_auto_auto] sm:items-center">
              <input className={input} value={d.name} onChange={(e) => set({ name: e.target.value })} aria-label="Hub name" />
              <input className={input} value={d.url} placeholder="https://… (empty = Coming soon)" onChange={(e) => set({ url: e.target.value })} aria-label="Hub link" />
              <input className={input} value={d.logo_url} placeholder={`/hub-logos/${h.slug}.png`} onChange={(e) => set({ logo_url: e.target.value })} aria-label="Logo link" />
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Shown
              </label>
              <button type="button" onClick={() => save(h.slug)} className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white">
                Save
              </button>
              {msg[h.slug] ? <p className="text-xs text-[var(--muted)] sm:col-span-5">{msg[h.slug]}</p> : null}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Who sees which hub</h2>
          <input className={`${input} max-w-56`} placeholder="Find a person" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="text-xs text-[var(--muted)]">
          Admins always see every shown hub. A tick only shows the tile here; the other hub still needs its own account and login for that person.
        </p>
        {msg.access ? <p className="text-xs text-red-600">{msg.access}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)]">
                <th className="py-1 pr-3 font-medium">Person</th>
                {hubs.map((h) => (
                  <th key={h.slug} className="px-2 py-1 text-center font-medium">{h.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="py-1.5 pr-3">
                    {p.name} <span className="text-xs text-[var(--muted)]">{p.role}</span>
                  </td>
                  {hubs.map((h) => (
                    <td key={h.slug} className="px-2 py-1.5 text-center">
                      {p.isOwner ? (
                        <span className="text-xs text-[var(--muted)]">owner · always</span>
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`${p.name}: ${h.name}`}
                          checked={granted.has(`${h.slug}:${p.id}`)}
                          onChange={(e) => toggle(h.slug, p.id, e.target.checked)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
