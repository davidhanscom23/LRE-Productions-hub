"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronDown, Search } from "lucide-react";
import {
  createPacketFromPastEventAction,
  listLaunchablePastEventsAction,
} from "@/app/(app)/event-packets/actions";
import type { LaunchablePastEvent } from "@/lib/event-packets/sync";

export function LaunchPastPacketPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<LaunchablePastEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [creatingUid, setCreatingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    startTransition(async () => {
      const result = await listLaunchablePastEventsAction();
      if (result.error) {
        setLoadError(result.error);
        setEvents([]);
      } else {
        setLoadError(null);
        setEvents(result.events ?? []);
      }
      setLoaded(true);
    });
  }, [open, loaded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => {
      const hay = [
        event.clientName,
        event.venue,
        event.eventType,
        event.eventDate,
        event.assignedStaff,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, query]);

  function handleCreate(uid: string) {
    setActionError(null);
    setCreatingUid(uid);
    startTransition(async () => {
      const result = await createPacketFromPastEventAction(uid);
      setCreatingUid(null);
      if (result.error || !result.packetId) {
        setActionError(result.error ?? "Could not create packet.");
        return;
      }
      router.push(`/event-packets/${result.packetId}`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <CalendarPlus className="h-4 w-4 text-[var(--brand)]" />
          Create packet from a past event
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 text-[var(--muted)] transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-xs text-[var(--muted)]">
            Use this when Sync didn&apos;t auto-create a packet. Shows events
            from the past 24 months through today (from the work calendar). You can
            also create a packet from an event&apos;s detail popup on Calendar.
          </p>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client, venue, date…"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              aria-label="Search past events"
            />
          </div>

          {loadError ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              {loadError}
            </p>
          ) : null}
          {actionError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              {actionError}
            </p>
          ) : null}

          {!loaded || (pending && !events.length) ? (
            <p className="py-4 text-center text-sm text-[var(--muted)]">
              Loading past events…
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted)]">
              {events.length === 0
                ? "No past events without a packet were found in the last 24 months of the work calendar feed."
                : "No events match that search."}
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
              {filtered.map((event) => (
                <li
                  key={event.uid}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {event.clientName}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {event.eventDate} · {event.venue} · {event.eventType}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleCreate(event.uid)}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {creatingUid === event.uid
                      ? "Creating…"
                      : "Create packet"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
