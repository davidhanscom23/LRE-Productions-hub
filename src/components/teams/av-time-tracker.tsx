"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, MapPin } from "lucide-react";
import {
  clockInAction,
  clockOutAction,
} from "@/app/(app)/teams/time-tracker-actions";
import type { AvClockInEventOption } from "@/lib/teams/av-clock-in-events";
import type { TimeEntry } from "@/lib/types/time-tracker";

type AvTimeTrackerProps = {
  openEntry: TimeEntry | null;
  recentEntries: TimeEntry[];
  clockInEvents?: AvClockInEventOption[];
  hasCalendarFeed?: boolean;
  isAdmin?: boolean;
  calendarError?: string | null;
};

function readGeo(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export function AvTimeTracker({
  openEntry,
  recentEntries,
  clockInEvents = [],
  hasCalendarFeed = false,
  isAdmin = false,
  calendarError = null,
}: AvTimeTrackerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"calendar" | "manual">(
    clockInEvents.length > 0 ? "calendar" : "manual",
  );
  const [selectedUid, setSelectedUid] = useState(clockInEvents[0]?.uid ?? "");
  const [eventName, setEventName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedEvent =
    clockInEvents.find((event) => event.uid === selectedUid) ?? null;
  const canSubmitCalendar =
    mode === "calendar" && Boolean(selectedEvent?.eventName);

  function handleClockIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const resolvedName =
        mode === "calendar"
          ? (selectedEvent?.eventName ?? "").trim()
          : eventName.trim();
      if (!resolvedName) {
        setError(
          mode === "calendar"
            ? "Select a calendar event to clock in."
            : "Event name is required.",
        );
        return;
      }

      const geo = await readGeo();
      const result = await clockInAction({
        department: "Audiovisual",
        eventName: resolvedName,
        notes,
        source: mode,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEventName("");
      setNotes("");
      router.refresh();
    });
  }

  function handleClockOut() {
    if (!openEntry) return;
    setError(null);
    startTransition(async () => {
      const result = await clockOutAction(openEntry.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
        <Clock className="h-3.5 w-3.5" />
        Time Tracker
      </h3>

      {openEntry ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)]/50 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Currently clocked in
            </p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {openEntry.event_name}
            </p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Since{" "}
              {new Date(openEntry.clocked_in_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            {openEntry.notes ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {openEntry.notes}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={handleClockOut}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--foreground)] text-sm font-semibold text-[var(--surface)] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Clocking out…" : "Clock Out"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleClockIn} className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Clock In to Event
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ModeButton
                label="From Calendar"
                active={mode === "calendar"}
                onClick={() => setMode("calendar")}
              />
              <ModeButton
                label="Manual Entry"
                active={mode === "manual"}
                onClick={() => setMode("manual")}
              />
            </div>
          </div>

          {mode === "calendar" ? (
            <div className="space-y-1.5">
              <label
                htmlFor="av-calendar-event"
                className="block text-sm font-medium text-[var(--foreground)]"
              >
                Select event <span className="text-[var(--brand)]">*</span>
              </label>
              {calendarError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                  Couldn’t load calendar: {calendarError}
                </p>
              ) : clockInEvents.length > 0 ? (
                <select
                  id="av-calendar-event"
                  value={selectedUid}
                  onChange={(e) => setSelectedUid(e.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                >
                  {clockInEvents.map((event) => (
                    <option key={event.uid} value={event.uid}>
                      {event.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3 text-sm text-[var(--muted)]">
                  {hasCalendarFeed ? (
                    <>
                      No upcoming events in the next two weeks. Use Manual Entry
                      or check{" "}
                      <Link
                        href="/my-week"
                        className="font-medium text-[var(--brand)] hover:underline"
                      >
                        My Week
                      </Link>
                      .
                    </>
                  ) : isAdmin ? (
                    <>
                      Set the HoneyBook calendar on{" "}
                      <Link
                        href="/calendar"
                        className="font-medium text-[var(--brand)] hover:underline"
                      >
                        Calendar
                      </Link>{" "}
                      to clock in from upcoming events, or use Manual Entry.
                    </>
                  ) : (
                    <>
                      Ask an admin to connect the HoneyBook calendar on Calendar so
                      upcoming events appear here, or use Manual Entry.
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor="av-event-name"
                className="block text-sm font-medium text-[var(--foreground)]"
              >
                Event name <span className="text-[var(--brand)]">*</span>
              </label>
              <input
                id="av-event-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required={mode === "manual"}
                placeholder="Client / venue / event"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="av-notes"
              className="block text-sm font-medium text-[var(--foreground)]"
            >
              Notes (optional)
            </label>
            <textarea
              id="av-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this shift…"
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            />
          </div>

          <p className="flex items-start gap-1.5 text-xs text-[var(--muted)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your GPS location will be recorded when available to verify
            you&apos;re on-site.
          </p>

          {error ? (
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={
              pending || (mode === "calendar" && !canSubmitCalendar)
            }
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Clocking in…" : "Clock In"}
          </button>
        </form>
      )}

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
          My Recent Shifts
        </p>
        {recentEntries.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No time entries yet</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {recentEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--foreground)]">
                    {entry.event_name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatRange(entry.clocked_in_at, entry.clocked_out_at)}
                  </p>
                </div>
                {entry.clocked_out_at ? (
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {formatDuration(entry.clocked_in_at, entry.clocked_out_at)}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]">
                    Open
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function formatRange(start: string, end: string | null) {
  const s = new Date(start);
  const startLabel = s.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end) return `Started ${startLabel}`;
  const e = new Date(end);
  return `${startLabel} – ${e.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
