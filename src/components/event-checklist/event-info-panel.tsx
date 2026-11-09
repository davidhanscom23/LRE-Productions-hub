"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVenueAction } from "@/app/(app)/event-checklist/actions";
import { FloorPlanSvg } from "@/components/floor-plans/floor-plan-svg";
import { ZoomPan } from "@/components/event-checklist/zoom-pan";
import { googleMapsSearchUrl } from "@/lib/calendar/format";
import type { EventInfo, InfoVenue } from "@/lib/event-checklist/types";
import { sanitizePlanData } from "@/lib/floor-plans/types";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

type Person = { role: string; name: string; phone?: string | null; email?: string | null };

function PersonRow({ p }: { p: Person }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{p.name || "Unnamed"}</p>
        <p className="text-xs text-[var(--muted)]">{p.role}</p>
      </div>
      <div className="flex gap-2">
        {p.phone ? (
          <a
            href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-hover)]"
          >
            Call {p.phone}
          </a>
        ) : null}
        {p.email ? (
          <a
            href={`mailto:${p.email}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-hover)]"
          >
            Email
          </a>
        ) : null}
      </div>
    </li>
  );
}

function addressOf(v: InfoVenue | null, fallback: string): string {
  if (!v) return fallback;
  const line = [v.address_line1, v.city, [v.region, v.postal_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return line || [v.name, fallback].filter(Boolean).join(" ");
}

const LOADIN_FIELDS: { key: keyof InfoVenue; label: string; hint: string }[] = [
  { key: "loading_dock_notes", label: "Loading dock / load-in door", hint: "Where to pull up, dock height, door code" },
  { key: "path_notes", label: "Path to the room", hint: "Elevators, stairs, carry distance" },
  { key: "load_in_hours", label: "Load-in hours", hint: "When the venue lets us in" },
  { key: "parking_notes", label: "Parking", hint: "Where trucks and crew park" },
  { key: "power_notes", label: "Power", hint: "Circuits, distro, outlet locations" },
  { key: "access_notes", label: "Access / check-in", hint: "Who to see, badge, security desk" },
  { key: "venue_rules", label: "Venue rules", hint: "Noise, hours, restrictions" },
];

function PlanViewer({ plan }: { plan: EventInfo["floor_plans"][number] }) {
  const data = sanitizePlanData(plan.data);
  const [url, setUrl] = useState<string | null>(null);
  const path = data.blueprint?.path;
  useEffect(() => {
    if (!path) return;
    let live = true;
    createBrowserSupabase()
      .storage.from("floor-plan-blueprints")
      .createSignedUrl(path, 3600)
      .then(({ data: d }) => {
        if (live) setUrl(d?.signedUrl ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [path]);
  return (
    <ZoomPan className="h-[60vh] rounded-xl border border-[var(--border)] bg-white">
      <FloorPlanSvg data={data} blueprintUrl={url} style={{ width: "100%", height: "auto", display: "block" }} />
    </ZoomPan>
  );
}

type Props = {
  info: EventInfo | null;
  projectId: string;
  fallbackLocation: string;
  venueOptions: { id: string; name: string }[];
};

export function EventInfoPanel({ info, projectId, fallbackLocation, venueOptions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const venue = info?.venue ?? null;
  const [venueId, setVenueId] = useState(venue?.id ?? "");
  const [venueName, setVenueName] = useState("");
  const [room, setRoom] = useState(info?.room ?? "");
  const [form, setForm] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of LOADIN_FIELDS) o[f.key] = String(venue?.[f.key] ?? "");
    o.contact_name = venue?.contact_name ?? "";
    o.phone = venue?.phone ?? "";
    o.email = venue?.email ?? "";
    o.address_line1 = venue?.address_line1 ?? "";
    o.city = venue?.city ?? "";
    o.region = venue?.region ?? "";
    o.postal_code = venue?.postal_code ?? "";
    return o;
  });

  if (!info) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
        Contacts, venue and floor plans show here once migration 193 has been run in Supabase.
      </section>
    );
  }

  const people: Person[] = [];
  if (info.client?.name || info.client?.phone || info.client?.email) {
    people.push({ role: "Client", name: info.client?.name ?? "", phone: info.client?.phone, email: info.client?.email });
  }
  if (info.customer && (info.customer.contact_name || info.customer.phone || info.customer.email)) {
    people.push({
      role: `Estimate contact (${info.customer.name ?? "customer"})`,
      name: info.customer.contact_name ?? info.customer.name ?? "",
      phone: info.customer.phone,
      email: info.customer.email,
    });
  }
  if (venue && (venue.contact_name || venue.phone || venue.email)) {
    people.push({ role: `Venue contact (${venue.name})`, name: venue.contact_name, phone: venue.phone, email: venue.email });
  }
  for (const s of info.staff) {
    people.push({ role: s.role === "lead" ? "Event lead" : "Support crew", name: s.name, phone: s.phone, email: s.email });
  }

  const address = addressOf(venue, fallbackLocation || info.project.location);
  const plan = info.floor_plans.find((p) => p.id === openPlan);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveVenueAction({
        projectId,
        venueId: venueId || null,
        venueName,
        room,
        fields: form,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold">Event details</h2>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Contacts</h3>
        {people.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {people.map((p, i) => (
              <PersonRow key={i} p={p} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">No contacts on file yet.</p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Venue</h3>
        <p className="mt-1 text-sm font-medium">
          {venue?.name || "No venue set"}
          {info.room ? ` · ${info.room}` : ""}
        </p>
        {address ? (
          <p className="text-sm">
            <a
              href={googleMapsSearchUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--brand)] underline"
            >
              {address}
            </a>
          </p>
        ) : null}
        {venue ? (
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {LOADIN_FIELDS.filter((f) => String(venue[f.key] ?? "").trim()).map((f) => (
              <div key={f.key}>
                <dt className="text-xs text-[var(--muted)]">{f.label}</dt>
                <dd className="whitespace-pre-wrap">{String(venue[f.key])}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {venue?.loadin_updated_at ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Load-in details last updated {new Date(venue.loadin_updated_at).toLocaleDateString("en-US")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-hover)]"
        >
          {editing ? "Cancel" : venue ? "Edit venue and load-in details" : "Add venue and load-in details"}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--muted)]">
            Load-in details stay with the venue, so the next event there starts with what you save now.
          </p>
          <label className="block text-sm">
            Venue
            <select className={input} value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              <option value="">New venue…</option>
              {venueOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          {!venueId ? (
            <input className={input} placeholder="Venue name" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
          ) : null}
          <input className={input} placeholder="Room / space" value={room} onChange={(e) => setRoom(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            {(["address_line1", "city", "region", "postal_code", "contact_name", "phone", "email"] as const).map((k) => (
              <input
                key={k}
                className={input}
                placeholder={k.replace("_", " ").replace("line1", "street address")}
                value={form[k] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            ))}
          </div>
          {LOADIN_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              {f.label}
              <textarea
                className={input}
                rows={2}
                placeholder={f.hint}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            </label>
          ))}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      ) : null}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Floor plans</h3>
        {info.floor_plans.length ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {info.floor_plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenPlan(openPlan === p.id ? null : p.id)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)]"
              >
                {p.name}
                {p.space_name ? ` · ${p.space_name}` : ""}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">
            No floor plan yet. Add one on the event card and it will show here.
          </p>
        )}
        {plan ? (
          <div className="mt-3">
            <PlanViewer plan={plan} />
            <p className="mt-1 text-xs text-[var(--muted)]">Pinch to zoom, drag to move, double-tap to reset.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
