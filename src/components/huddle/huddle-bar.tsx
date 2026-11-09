"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, PhoneOff, Video, X } from "lucide-react";

type Huddle = {
  id: string;
  joinUrl: string;
  topic: string | null;
  startedAt: string;
  endsAt: string;
} | null;

type Scheduled = {
  id: string;
  joinUrl: string;
  topic: string | null;
  scheduledAt: string;
} | null;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Default the datetime-local picker to the next round half hour, local time. */
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  // Format as YYYY-MM-DDTHH:MM in LOCAL time for <input type="datetime-local">.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Conflict = {
  title: string;
  start: string;
  end: string | null;
};

export function HuddleBar({ isAdmin }: { isAdmin: boolean }) {
  const [huddle, setHuddle] = useState<Huddle>(null);
  const [scheduled, setScheduled] = useState<Scheduled>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [schedAt, setSchedAt] = useState("");
  const [schedTopic, setSchedTopic] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  // Tracked in state (not read via Date.now() during render) so the "ready to
  // start" flip stays a pure render. Updated on each poll.
  const [now, setNow] = useState(0);

  async function refresh() {
    setNow(Date.now());
    try {
      const r = await fetch("/api/huddle");
      const d = await r.json();
      setHuddle((d.huddle as Huddle) ?? null);
      setScheduled((d.scheduled as Scheduled) ?? null);
    } catch {
      /* ignore transient errors */
    }
  }

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), 20000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  async function start(id?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/huddle/start", {
        method: "POST",
        headers: id ? { "content-type": "application/json" } : undefined,
        body: id ? JSON.stringify({ id }) : undefined,
      });
      const d = await r.json();
      const link = d.startUrl || d.joinUrl;
      if (link) window.open(link, "_blank", "noopener");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function end(id?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/huddle/end", {
        method: "POST",
        headers: id ? { "content-type": "application/json" } : undefined,
        body: id ? JSON.stringify({ id }) : undefined,
      });
      if (id) setScheduled(null);
      else setHuddle(null);
    } finally {
      setBusy(false);
    }
  }

  function openForm() {
    setSchedAt(defaultScheduleValue());
    setSchedTopic("");
    setFormError(null);
    setConflicts([]);
    setShowForm(true);
  }

  async function submitSchedule(force = false) {
    if (busy) return;
    if (!schedAt) {
      setFormError("Pick a date and time.");
      return;
    }
    const iso = new Date(schedAt).toISOString();
    setBusy(true);
    setFormError(null);
    if (!force) setConflicts([]);
    try {
      const r = await fetch("/api/huddle/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduledAt: iso,
          topic: schedTopic,
          force,
        }),
      });
      const d = await r.json();
      if (r.status === 409 && d.code === "calendar_conflict") {
        setConflicts(
          Array.isArray(d.conflicts)
            ? (d.conflicts as Conflict[]).map((c) => ({
                title: String(c.title ?? "Event"),
                start: String(c.start ?? ""),
                end: c.end ? String(c.end) : null,
              }))
            : [],
        );
        setFormError(
          d.error ||
            "That time overlaps calendar events. Schedule anyway, or pick another time.",
        );
        return;
      }
      if (!r.ok) {
        setFormError(d.error || "Could not schedule the huddle.");
        return;
      }
      setShowForm(false);
      setConflicts([]);
      await refresh();
    } catch {
      setFormError("Could not schedule the huddle.");
    } finally {
      setBusy(false);
    }
  }

  // 1) A live huddle takes over the bar (red).
  if (huddle) {
    return (
      <div className="flex items-center justify-between gap-3 bg-red-600 px-4 py-2 text-white">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="truncate">
            Team huddle is live{huddle.topic ? ` — ${huddle.topic}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={huddle.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-sm font-semibold text-red-700 hover:bg-white/90"
          >
            <Video className="h-3.5 w-3.5" />
            Join
          </a>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => end()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-700/60 px-2 py-1 text-xs font-medium hover:bg-red-700 disabled:opacity-60"
            >
              <PhoneOff className="h-3 w-3" />
              End
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // 2) A scheduled (not-yet-live) huddle — shown to everyone so staff see it on
  //    login. Admins additionally get Start now / Cancel controls.
  if (scheduled) {
    const due = now > 0 && new Date(scheduled.scheduledAt).getTime() <= now;
    return (
      <div className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-[var(--foreground)]">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="truncate">
            {isAdmin && due ? "Team huddle ready to start" : "Team huddle scheduled"} —{" "}
            {formatWhen(scheduled.scheduledAt)}
            {scheduled.topic ? ` · ${scheduled.topic}` : ""}
          </span>
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => start(scheduled.id)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Video className="h-3.5 w-3.5" />
              {busy ? "Starting…" : "Start now"}
            </button>
            <button
              type="button"
              onClick={() => end(scheduled.id)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-hover)] disabled:opacity-60"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        ) : (
          <span className="shrink-0 text-xs text-[var(--muted)]">
            Join link posts when it starts
          </span>
        )}
      </div>
    );
  }

  // 3) Admin controls: start now, or schedule for later.
  if (isAdmin) {
    return (
      <div className="px-4 py-1">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => start()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
          >
            <Video className="h-3.5 w-3.5" />
            {busy ? "Starting…" : "Start team huddle"}
          </button>
          <button
            type="button"
            onClick={() => (showForm ? setShowForm(false) : openForm())}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Schedule
          </button>
        </div>

        {showForm ? (
          <div className="mt-1 flex flex-wrap items-end justify-end gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <label className="flex flex-col text-[11px] font-medium text-[var(--muted)]">
              Date &amp; time
              <input
                type="datetime-local"
                value={schedAt}
                onChange={(e) => setSchedAt(e.target.value)}
                className="mt-0.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="flex flex-col text-[11px] font-medium text-[var(--muted)]">
              Topic (optional)
              <input
                type="text"
                value={schedTopic}
                onChange={(e) => setSchedTopic(e.target.value)}
                placeholder="e.g. Weekly sync"
                className="mt-0.5 w-48 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
              />
            </label>
            <button
              type="button"
              onClick={() => submitSchedule(false)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {busy ? "Scheduling…" : "Schedule"}
            </button>
            {conflicts.length > 0 ? (
              <div className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="font-semibold">Overlaps the calendar (~60 min window)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {conflicts.map((c) => (
                    <li key={`${c.title}-${c.start}`}>
                      {c.title}
                      {c.start
                        ? ` — ${formatWhen(c.start)}`
                        : ""}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => submitSchedule(true)}
                  disabled={busy}
                  className="mt-2 inline-flex rounded-md bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                >
                  Schedule anyway
                </button>
              </div>
            ) : null}
            {formError ? (
              <p className="w-full text-right text-xs text-red-600">{formError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
