"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
} from "lucide-react";
import {
  EventDetailModal,
  StatusBadge,
  useEventDetail,
} from "@/components/calendar/event-detail-modal";
import { HoneybookIcalSettingsForm } from "@/components/calendar/honeybook-ical-settings-form";
import { CalendarStats } from "@/components/calendar/calendar-stats";
import { CalendarAvailability } from "@/components/calendar/calendar-availability";
import type {
  StaffAvailabilityEntry,
  TeamTimeOffRow,
} from "@/lib/calendar/availability";
import type { CalendarEvent } from "@/lib/calendar/events";
import {
  addDays,
  eventDayKey,
  eventsOnDay,
  formatDayHeading,
  formatDtTimeRange,
  formatEventDate,
  monthGrid,
  monthLabel,
  parseDateInputValue,
  sameDay,
  startOfLocalDay,
  toDateInputValue,
  upcomingEvents,
  weekGrid,
  weekLabel,
  yearLabel,
  type CalendarView,
} from "@/lib/calendar/format";
import { eventMatchesQuery } from "@/lib/calendar/match-events";
import {
  matchStaffColor,
  staffChipStyle,
  type StaffColorEntry,
} from "@/lib/people/color";

type CalendarPageClientProps = {
  configured: boolean;
  events: CalendarEvent[];
  fetchError: string | null;
  isAdmin?: boolean;
  canAssignStaff?: boolean;
  staffColors?: StaffColorEntry[];
  staff?: StaffAvailabilityEntry[];
  teamTimeOff?: TeamTimeOffRow[];
  /** HoneyBook→Google iCal feed configured */
  honeybookIcalConfigured?: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

const TIME_OFF_CHIP = {
  backgroundColor: "var(--surface-hover)",
  color: "var(--muted)",
  borderColor: "var(--border)",
};

const HONEYBOOK_CHIP = {
  backgroundColor: "color-mix(in srgb, var(--brand) 18%, transparent)",
  color: "var(--brand)",
  borderColor: "color-mix(in srgb, var(--brand) 35%, transparent)",
};

function chipStyleFor(event: CalendarEvent, staffColors: StaffColorEntry[]) {
  if (event.source === "timeoff") return TIME_OFF_CHIP;
  if (event.source === "honeybook") return HONEYBOOK_CHIP;
  const color = matchStaffColor(event.assignedStaff, staffColors);
  const chip = staffChipStyle(color);
  return {
    backgroundColor: chip.backgroundColor,
    color: chip.color,
    borderColor: chip.borderColor ?? "transparent",
  };
}

function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function CalendarPageClient({
  configured,
  events,
  fetchError,
  isAdmin = false,
  canAssignStaff = false,
  staffColors = [],
  staff = [],
  teamTimeOff = [],
  honeybookIcalConfigured = false,
}: CalendarPageClientProps) {
  const [view, setView] = useState<CalendarView>("month");
  const [selected, setSelected] = useState<Date>(() => todayLocal());
  const [today] = useState<Date>(() => todayLocal());
  const [jumpOpen, setJumpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const detail = useEventDetail();
  const calendarRef = useRef<HTMLElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number | null>(null);
  const [isWide, setIsWide] = useState(false);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;

  const year = selected.getFullYear();
  const month = selected.getMonth();
  const monthCells = useMemo(() => monthGrid(year, month), [year, month]);
  const weekCells = useMemo(() => weekGrid(selected), [selected]);
  const upcoming = useMemo(() => upcomingEvents(events), [events]);
  const selectedEvents = useMemo(
    () => eventsOnDay(events, selected),
    [events, selected],
  );
  const searchMatches = useMemo(() => {
    if (!searching) return [];
    return events
      .filter((event) => eventMatchesQuery(event, trimmedQuery))
      .slice(0, 80);
  }, [events, searching, trimmedQuery]);

  const heading = useMemo(() => {
    if (view === "day") return formatDayHeading(selected);
    if (view === "week") return weekLabel(selected);
    if (view === "year") return yearLabel(year);
    return monthLabel(year, month);
  }, [view, selected, year, month]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const syncWide = () => setIsWide(media.matches);
    syncWide();
    media.addEventListener("change", syncWide);
    return () => media.removeEventListener("change", syncWide);
  }, []);

  useEffect(() => {
    const node = calendarRef.current;
    if (!node) return;
    const syncHeight = () => {
      setSidebarHeight(node.getBoundingClientRect().height);
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [configured, view, selected]);

  useEffect(() => {
    if (!jumpOpen) return;
    jumpInputRef.current?.showPicker?.();
    jumpInputRef.current?.focus();
  }, [jumpOpen]);

  function goToDate(day: Date, nextView?: CalendarView) {
    setSelected(startOfLocalDay(day));
    if (nextView) setView(nextView);
  }

  function shift(delta: number) {
    if (view === "day") {
      goToDate(addDays(selected, delta));
      return;
    }
    if (view === "week") {
      goToDate(addDays(selected, delta * 7));
      return;
    }
    if (view === "year") {
      goToDate(new Date(year + delta, selected.getMonth(), 1));
      return;
    }
    goToDate(new Date(year, month + delta, 1));
  }

  function jumpToInputValue(value: string) {
    const parsed = parseDateInputValue(value);
    if (!parsed) return;
    goToDate(parsed, view === "year" ? "month" : view);
    setJumpOpen(false);
  }

  function openEventFromSidebar(event: CalendarEvent) {
    const day = parseDateInputValue(eventDayKey(event.start));
    if (day) goToDate(day, view === "year" ? "month" : view);
    detail.open(event);
  }

  const title = isAdmin ? "Company Events" : "Work Calendar";
  const subtitle = isAdmin
    ? "HoneyBook projects and events for the team"
    : "Shared team calendar from HoneyBook";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Calendar
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>

      {!configured ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-6 py-10 text-center">
            <p className="font-medium text-[var(--foreground)]">
              {isAdmin
                ? "Connect the HoneyBook calendar"
                : "No calendar connected yet"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
              {isAdmin ? (
                <>
                  Paste the Google Calendar{" "}
                  <span className="font-medium">secret iCal URL</span> for
                  HoneyBook Calendar — LRE Productions (from Google Calendar
                  → Settings and sharing → Integrate calendar).
                </>
              ) : (
                <>
                  Ask an admin to connect the HoneyBook calendar on this page.
                </>
              )}
            </p>
          </div>
          {isAdmin ? (
            <HoneybookIcalSettingsForm configured={false} />
          ) : null}
        </div>
      ) : (
        <>
          {fetchError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              Couldn’t load a calendar feed: {fetchError}
            </div>
          ) : null}

          <CalendarStats events={events} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
            <section
              ref={calendarRef}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
            >
              <div className="mb-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    {heading}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => shift(-1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      aria-label={`Previous ${view}`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => goToDate(todayLocal())}
                      className="h-9 rounded-lg px-3 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setJumpOpen((open) => !open)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      aria-expanded={jumpOpen}
                      aria-controls="calendar-jump-date"
                    >
                      <CalendarRange className="h-4 w-4" />
                      Go to
                    </button>
                    <button
                      type="button"
                      onClick={() => shift(1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      aria-label={`Next ${view}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    role="tablist"
                    aria-label="Calendar view"
                    className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5"
                  >
                    {VIEWS.map((option) => {
                      const active = view === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setView(option.id)}
                          className={[
                            "h-8 rounded-md px-2.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm",
                            active
                              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                              : "text-[var(--muted)] hover:text-[var(--foreground)]",
                          ].join(" ")}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {jumpOpen ? (
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                      <span className="sr-only">Jump to date</span>
                      <input
                        id="calendar-jump-date"
                        ref={jumpInputRef}
                        type="date"
                        value={toDateInputValue(selected)}
                        onChange={(e) => jumpToInputValue(e.target.value)}
                        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              {view === "day" ? (
                <DayView
                  day={selected}
                  events={selectedEvents}
                  staffColors={staffColors}
                  onOpenEvent={detail.open}
                />
              ) : null}

              {view === "week" ? (
                <WeekView
                  days={weekCells}
                  selected={selected}
                  today={today}
                  events={events}
                  staffColors={staffColors}
                  onSelectDay={goToDate}
                  onOpenEvent={(event, day) => {
                    goToDate(day);
                    detail.open(event);
                  }}
                />
              ) : null}

              {view === "month" ? (
                <MonthView
                  year={year}
                  month={month}
                  cells={monthCells}
                  selected={selected}
                  today={today}
                  events={events}
                  staffColors={staffColors}
                  onSelectDay={goToDate}
                  onOpenEvent={(event, day) => {
                    goToDate(day);
                    detail.open(event);
                  }}
                />
              ) : null}

              {view === "year" ? (
                <YearView
                  year={year}
                  selected={selected}
                  today={today}
                  events={events}
                  onSelectDay={(day) => goToDate(day, "day")}
                />
              ) : null}
            </section>

            <aside
              className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
              style={{
                height: isWide && sidebarHeight ? sidebarHeight : undefined,
                maxHeight:
                  !isWide ? "min(32rem, 70vh)" : sidebarHeight ?? undefined,
              }}
            >
              <div className="shrink-0 space-y-3 border-b border-[var(--border)] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Upcoming Events
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Your next events.
                  </p>
                </div>
                {events.length > 0 ? (
                  <label className="relative block">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by client, venue, staff, date…"
                      aria-label="Search calendar events"
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                    />
                  </label>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                {searching ? (
                  searchMatches.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      No events match “{trimmedQuery}”.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {searchMatches.map((event) => (
                        <EventRow
                          key={`search-${event.uid}-${event.start}`}
                          event={event}
                          staffColors={staffColors}
                          onOpen={() => openEventFromSidebar(event)}
                        />
                      ))}
                    </ul>
                  )
                ) : (
                  <>
                    {selectedEvents.length > 0 ? (
                      <div className="mb-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                          {formatDayHeading(selected)}
                        </p>
                        <ul className="mt-2 space-y-2">
                          {selectedEvents.map((event) => (
                            <EventRow
                              key={`selected-${event.uid}-${event.start}`}
                              event={event}
                              compact
                              staffColors={staffColors}
                              onOpen={() => detail.open(event)}
                            />
                          ))}
                        </ul>
                        <div className="my-4 border-t border-[var(--border)]" />
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                          Upcoming
                        </p>
                      </div>
                    ) : null}

                    {upcoming.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">
                        No upcoming events.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {upcoming.map((event) => (
                          <EventRow
                            key={`${event.uid}-${event.start}`}
                            event={event}
                            staffColors={staffColors}
                            onOpen={() => detail.open(event)}
                          />
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>

          <CalendarAvailability
            staff={staff}
            timeOff={teamTimeOff}
            events={events}
          />

          {isAdmin ? (
            <div className="mt-6 space-y-4">
              <HoneybookIcalSettingsForm configured={honeybookIcalConfigured} />
            </div>
          ) : null}
        </>
      )}

      {detail.active ? (
        <EventDetailModal
          key={detail.active.uid}
          event={detail.active}
          onClose={detail.close}
          canAssignStaff={canAssignStaff}
          assignableStaff={staff}
        />
      ) : null}
    </div>
  );
}

function DayView({
  day,
  events,
  staffColors,
  onOpenEvent,
}: {
  day: Date;
  events: CalendarEvent[];
  staffColors: StaffColorEntry[];
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
      <p className="text-sm text-[var(--muted)]">{formatDayHeading(day)}</p>
      {events.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">No events this day.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((event) => (
            <EventRow
              key={`day-${event.uid}-${event.start}`}
              event={event}
              staffColors={staffColors}
              onOpen={() => onOpenEvent(event)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function WeekView({
  days,
  selected,
  today,
  events,
  staffColors,
  onSelectDay,
  onOpenEvent,
}: {
  days: Date[];
  selected: Date;
  today: Date;
  events: CalendarEvent[];
  staffColors: StaffColorEntry[];
  onSelectDay: (day: Date) => void;
  onOpenEvent: (event: CalendarEvent, day: Date) => void;
}) {
  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dayEvents = eventsOnDay(events, day);
        const isSelected = sameDay(day, selected);
        const isToday = sameDay(day, today);
        return (
          <div
            key={day.toISOString()}
            className={[
              "rounded-xl border p-4",
              isSelected
                ? "border-[var(--brand)] ring-2 ring-[var(--brand)]"
                : "border-[var(--border)] bg-[var(--background)]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  {WEEKDAYS[day.getDay()]}
                </p>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {formatDayHeading(day)}
                </p>
              </div>
              <span
                className={[
                  "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  isToday
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--surface-hover)] text-[var(--foreground)]",
                ].join(" ")}
              >
                {day.getDate()}
              </span>
            </button>

            {dayEvents.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">No events this day.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {dayEvents.map((event) => (
                  <EventRow
                    key={`week-${event.uid}-${event.start}`}
                    event={event}
                    staffColors={staffColors}
                    onOpen={() => onOpenEvent(event, day)}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  year,
  month,
  cells,
  selected,
  today,
  events,
  staffColors,
  onSelectDay,
  onOpenEvent,
}: {
  year: number;
  month: number;
  cells: Date[];
  selected: Date;
  today: Date;
  events: CalendarEvent[];
  staffColors: StaffColorEntry[];
  onSelectDay: (day: Date) => void;
  onOpenEvent: (event: CalendarEvent, day: Date) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const inMonth = day.getMonth() === month && day.getFullYear() === year;
          const isSelected = sameDay(day, selected);
          const isToday = sameDay(day, today);
          const dayEvents = eventsOnDay(events, day);
          return (
            <div
              key={day.toISOString()}
              className={[
                "min-h-[4.25rem] rounded-xl border p-1.5 text-left sm:min-h-[5rem]",
                inMonth
                  ? "border-[var(--border)] bg-[var(--background)]"
                  : "border-transparent bg-transparent opacity-45",
                isSelected ? "ring-2 ring-[var(--brand)]" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={[
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                ].join(" ")}
                aria-label={formatDayHeading(day)}
              >
                {day.getDate()}
              </button>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => {
                  const chip = chipStyleFor(event, staffColors);
                  return (
                    <button
                      key={`${event.uid}-${event.start}`}
                      type="button"
                      onClick={() => onOpenEvent(event, day)}
                      className="block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] font-medium hover:opacity-90"
                      style={{
                        backgroundColor: chip.backgroundColor,
                        color: chip.color,
                        borderColor: chip.borderColor ?? "transparent",
                      }}
                      title={
                        event.assignedStaff
                          ? `${event.title} · ${event.assignedStaff}`
                          : event.title
                      }
                    >
                      {event.title}
                    </button>
                  );
                })}
                {dayEvents.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="px-1 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    +{dayEvents.length - 2} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function YearView({
  year,
  selected,
  today,
  events,
  onSelectDay,
}: {
  year: number;
  selected: Date;
  today: Date;
  events: CalendarEvent[];
  onSelectDay: (day: Date) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const cells = monthGrid(year, monthIndex);
        return (
          <div
            key={monthIndex}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
          >
            <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">
              {new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
                month: "long",
              })}
            </p>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-semibold tracking-wide text-[var(--muted)] uppercase">
              {WEEKDAYS.map((day) => (
                <div key={day}>{day.charAt(0)}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-0.5">
              {cells.map((day) => {
                const inMonth = day.getMonth() === monthIndex;
                const isSelected = sameDay(day, selected);
                const isToday = sameDay(day, today);
                const hasEvents = eventsOnDay(events, day).length > 0;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={!inMonth}
                    onClick={() => onSelectDay(day)}
                    className={[
                      "relative flex h-7 items-center justify-center rounded-md text-[11px] font-medium",
                      !inMonth
                        ? "invisible"
                        : isToday
                          ? "bg-[var(--brand)] text-white"
                          : isSelected
                            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                            : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                    ].join(" ")}
                    aria-label={formatDayHeading(day)}
                  >
                    {day.getDate()}
                    {hasEvents && inMonth && !isToday ? (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--brand)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventRow({
  event,
  compact = false,
  staffColors = [],
  onOpen,
}: {
  event: CalendarEvent;
  compact?: boolean;
  staffColors?: StaffColorEntry[];
  onOpen: () => void;
}) {
  const time = formatDtTimeRange(event.start, event.end, event.allDay);
  const staffColor = matchStaffColor(event.assignedStaff, staffColors);
  const accent =
    event.source === "timeoff"
      ? "var(--border)"
      : event.source === "honeybook"
        ? "var(--brand)"
        : staffColor;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={[
          "w-full text-left transition-colors hover:border-[var(--brand)]/40",
          compact
            ? "rounded-lg border border-[var(--border)] px-3 py-2"
            : "rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3",
        ].join(" ")}
        style={
          accent
            ? { borderLeftWidth: 4, borderLeftColor: accent }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-medium text-[var(--foreground)]">
            {event.title}
          </p>
          <StatusBadge status={event.status} />
        </div>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          {formatEventDate(event.start)}
          {time ? ` · ${time}` : ""}
        </p>
        {event.assignedStaff ? (
          <p
            className="mt-1 text-xs font-medium"
            style={{ color: staffColor ?? "var(--muted)" }}
          >
            {event.assignedStaff}
          </p>
        ) : null}
        {event.venue ? (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--muted)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{event.venue}</span>
          </p>
        ) : null}
        {event.clientName && !event.title.includes(event.clientName) ? (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--muted)]">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{event.clientName}</span>
          </p>
        ) : null}
        {event.clientContact ? (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--muted)]">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{event.clientContact}</span>
          </p>
        ) : null}
        {event.clientPhone ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--foreground)]">
            <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            <span className="truncate font-medium">{event.clientPhone}</span>
          </p>
        ) : null}
        {event.clientEmail ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--foreground)]">
            <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            <span className="truncate font-medium">{event.clientEmail}</span>
          </p>
        ) : null}
        {event.planningFormUrl || (event.relatedFiles?.length ?? 0) > 0 ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--brand)]">
            {(event.relatedFiles?.length ?? 0) > 0
              ? event.relatedFiles
                  .filter((file) => file.url !== event.eventUrl)
                  .slice(0, 3)
                  .map((file) => (
                    <span
                      key={file.url}
                      className="inline-flex items-center gap-1.5 font-medium"
                    >
                      <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      {file.title}
                    </span>
                  ))
              : event.planningFormUrl ? (
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                    Planning form
                  </span>
                ) : null}
          </p>
        ) : null}
      </button>
    </li>
  );
}
