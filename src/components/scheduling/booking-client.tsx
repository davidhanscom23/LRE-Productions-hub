"use client";

import { createBookingAction, getSlotsAction } from "@/app/book/[slug]/actions";
import { useState, useTransition } from "react";

type Props = {
  slug: string;
  title: string;
  description: string;
  durationMin: number;
  location: string;
  timezone: string;
  minDate: string;
  maxDate: string;
};

const field =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function DatePicker({ value, min, max, onPick }: { value: string; min: string; max: string; onPick: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const [y0, m0] = (value || min).split("-").map(Number);
  const [view, setView] = useState({ y: y0, m: m0 - 1 });
  const lead = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const monthKey = `${view.y}-${pad(view.m + 1)}`;
  const canPrev = monthKey > min.slice(0, 7);
  const canNext = monthKey < max.slice(0, 7);
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(view.y, view.m, 1));
  const shown = value
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
    : "Choose a date";
  const step = (delta: number) => {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  return (
    <div className="relative">
      <p className="mb-1 text-sm font-medium text-neutral-900">Pick a day</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full max-w-xs items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm text-neutral-900"
      >
        <span>{shown}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-72 rounded-xl border border-neutral-300 bg-white p-3 text-neutral-900 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label="Previous month" className="rounded px-2 py-1 text-lg disabled:opacity-30">‹</button>
            <span className="text-sm font-semibold">{label}</span>
            <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label="Next month" className="rounded px-2 py-1 text-lg disabled:opacity-30">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-600">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <span key={`b${i}`} />;
              const key = ymd(view.y, view.m, d);
              const off = key < min || key > max;
              const on = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={off}
                  onClick={() => { onPick(key); setOpen(false); }}
                  className={`rounded-md py-1.5 text-sm ${on ? "bg-neutral-900 font-semibold text-white" : "text-neutral-900 hover:bg-neutral-200"} disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingClient(p: Props) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ when: string; token: string } | null>(null);
  const [pending, start] = useTransition();

  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: p.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const pickDate = (d: string) => {
    setDate(d);
    setSlot("");
    setSlots(null);
    setError(null);
    if (!d) return;
    start(async () => {
      const res = await getSlotsAction({ slug: p.slug, date: d });
      setSlots(res.slots);
    });
  };

  const book = () =>
    start(async () => {
      setError(null);
      const res = await createBookingAction({ slug: p.slug, startIso: slot, name, email, phone, notes, website });
      if (res.error) setError(res.error);
      else setDone({ when: res.when ?? "", token: res.cancelToken ?? "" });
    });

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
        <h2 className="text-lg font-semibold">You are booked</h2>
        {done.when && <p className="mt-1 text-sm">{done.when}</p>}
        <p className="mt-2 text-sm">We emailed a confirmation with a calendar invite. Check your spam folder if you do not see it.</p>
        {done.token && (
          <p className="mt-2 text-sm">
            Need to change it? <a className="underline" href={`/book/cancel/${done.token}`}>Cancel this booking</a>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <p className="text-sm text-neutral-600">{p.durationMin} minutes · {p.location}</p>
        {p.description && <p className="mt-2 text-sm text-neutral-700">{p.description}</p>}
      </div>
      <DatePicker value={date} min={p.minDate} max={p.maxDate} onPick={pickDate} />
      {date && (
        <div>
          <p className="mb-2 text-sm font-medium">Times (Eastern unless noted: {p.timezone.replace("_", " ")})</p>
          {slots === null ? (
            <p className="text-sm text-neutral-500">Checking…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-neutral-600">No times that day. Try another day.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${slot === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"}`}
                >
                  {time(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {slot && (
        <div className="flex flex-col gap-2">
          <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className={field} type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          <textarea className={field} placeholder="Anything we should know? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            onClick={book}
            disabled={pending || !name.trim() || !email.trim()}
          >
            {pending ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      )}
    </div>
  );
}
