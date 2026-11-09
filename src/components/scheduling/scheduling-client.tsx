"use client";

import { cancelBookingAdminAction, saveMeetingTypeAction } from "@/app/(app)/scheduling/actions";
import { DAYS, windowsToText, type Weekly } from "@/lib/scheduling/slots";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type TypeRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  duration_min: number;
  buffer_min: number;
  min_notice_hours: number;
  max_days_ahead: number;
  location: string;
  timezone: string;
  weekly: Weekly;
  active: boolean;
};
export type BookingRow = {
  id: string;
  start_at: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  type_title: string;
  timezone: string;
  project_id: string | null;
};

const field =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--foreground)]";
const btn =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium disabled:opacity-40";
const DAY_LABEL: Record<string, string> = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

type Draft = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  durationMin: string;
  bufferMin: string;
  minNoticeHours: string;
  maxDaysAhead: string;
  location: string;
  timezone: string;
  hoursText: Record<string, string>;
  active: boolean;
};

const newDraft = (): Draft => ({
  slug: "",
  title: "",
  description: "",
  durationMin: "30",
  bufferMin: "15",
  minNoticeHours: "12",
  maxDaysAhead: "60",
  location: "We will call you at the number you provide.",
  timezone: "America/New_York",
  hoursText: { mon: "09:00-17:00", tue: "09:00-17:00", wed: "09:00-17:00", thu: "09:00-17:00", fri: "09:00-17:00", sat: "", sun: "" },
  active: true,
});

const fromRow = (r: TypeRow): Draft => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description,
  durationMin: String(r.duration_min),
  bufferMin: String(r.buffer_min),
  minNoticeHours: String(r.min_notice_hours),
  maxDaysAhead: String(r.max_days_ahead),
  location: r.location,
  timezone: r.timezone,
  hoursText: Object.fromEntries(DAYS.map((d) => [d, windowsToText(r.weekly?.[d])])),
  active: r.active,
});

export function SchedulingClient({ types, bookings, baseUrl }: { types: TypeRow[]; bookings: BookingRow[]; baseUrl: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (!draft) return;
      const res = await saveMeetingTypeAction({
        id: draft.id,
        slug: draft.slug,
        title: draft.title,
        description: draft.description,
        durationMin: Number(draft.durationMin),
        bufferMin: Number(draft.bufferMin),
        minNoticeHours: Number(draft.minNoticeHours),
        maxDaysAhead: Number(draft.maxDaysAhead),
        location: draft.location,
        timezone: draft.timezone.trim(),
        hoursText: draft.hoursText,
        active: draft.active,
      });
      if (res.error) setMsg(res.error);
      else {
        setMsg("Saved.");
        setDraft(null);
        router.refresh();
      }
    });

  const cancel = (b: BookingRow) => {
    if (!window.confirm(`Cancel ${b.name}'s booking? They won't be emailed, so reach out to them yourself.`)) return;
    start(async () => {
      const res = await cancelBookingAdminAction(b.id);
      setMsg(res.error ?? "Booking cancelled.");
      if (!res.error) router.refresh();
    });
  };

  const when = (b: BookingRow) =>
    new Intl.DateTimeFormat("en-US", { timeZone: b.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(b.start_at));

  return (
    <div className="flex flex-col gap-4">
      {msg && <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">{msg}</p>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Booking pages</h2>
          <button className={btn} onClick={() => setDraft(newDraft())}>+ New booking page</button>
        </div>
        {types.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No booking pages yet. Create one to get a link clients can use.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {types.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{t.title} {!t.active && <span className="text-xs text-[var(--muted)]">(off)</span>}</p>
                  <p className="text-xs text-[var(--muted)]">{t.duration_min} min · {baseUrl}/book/{t.slug}</p>
                </div>
                <div className="flex gap-1.5">
                  <a className={btn} href={`/book/${t.slug}`} target="_blank" rel="noreferrer">Open</a>
                  <button className={btn} onClick={() => navigator.clipboard?.writeText(`${baseUrl}/book/${t.slug}`).then(() => setMsg("Link copied."))}>Copy link</button>
                  <button className={btn} onClick={() => setDraft(fromRow(t))}>Edit</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft && (
        <section className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold">{draft.id ? "Edit booking page" : "New booking page"}</h2>
          <input className={field} placeholder="Title (e.g. Free planning call)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <label className="flex flex-wrap items-center gap-1 text-sm">
            Link name: /book/
            <input className={`${field} w-48`} placeholder="planning-call" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          </label>
          <textarea className={field} placeholder="What clients should know (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <input className={field} placeholder="Where it happens (phone, Zoom link, address)" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ["durationMin", "Length (min)"],
              ["bufferMin", "Buffer (min)"],
              ["minNoticeHours", "Notice (hours)"],
              ["maxDaysAhead", "Days ahead"],
            ] as const).map(([k, label]) => (
              <label key={k} className="text-xs">
                {label}
                <input className={`${field} mt-1 w-full`} type="number" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <label className="text-xs">
            Time zone
            <input className={`${field} mt-1 w-full max-w-xs`} value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} />
          </label>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-[var(--muted)]">Hours you take meetings (24-hour, like 09:00-12:00, 13:00-17:00; leave blank for days off)</p>
            {DAYS.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <span className="w-10">{DAY_LABEL[d]}</span>
                <input className={`${field} flex-1`} value={draft.hoursText[d] ?? ""} onChange={(e) => setDraft({ ...draft, hoursText: { ...draft.hoursText, [d]: e.target.value } })} />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Page is live
          </label>
          <div className="flex gap-2">
            <button className={btn} onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            <button className={btn} onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">Upcoming bookings</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing booked yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{when(b)} · {b.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {b.type_title} · {b.email}{b.phone ? ` · ${b.phone}` : ""}
                    {b.project_id && <> · <a className="underline" href={`/honeybook/projects/${b.project_id}`}>project</a></>}
                  </p>
                  {b.notes && <p className="text-xs">{b.notes}</p>}
                </div>
                <button className={btn} onClick={() => cancel(b)} disabled={pending}>Cancel</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
