"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import {
  createTaskAction,
  deleteTaskAction,
  toggleHoneyBookTaskHubDoneAction,
  toggleTaskDoneAction,
} from "@/app/(app)/my-week/actions";
import { StatusBadge } from "@/components/calendar/event-detail-modal";
import type { CalendarEvent } from "@/lib/calendar/events";
import {
  formatDescriptionTimeRange,
  formatEventDate,
} from "@/lib/calendar/format";
import {
  matchStaffColor,
  type StaffColorEntry,
} from "@/lib/people/color";
import {
  honeyBookTaskIsOpen,
  type HoneyBookTask,
} from "@/lib/types/honeybook-tasks";
import type { Task } from "@/lib/types/tasks";

type DailyQuoteProp = {
  text: string;
  author: string;
};

type MyWeekPageClientProps = {
  firstName: string;
  todayLabel: string;
  dailyQuote: DailyQuoteProp | null;
  events: CalendarEvent[];
  hasCalendarFeed: boolean;
  isAdmin: boolean;
  calendarError: string | null;
  tasks: Task[];
  honeyBookTasks?: HoneyBookTask[];
  staffColors?: StaffColorEntry[];
};

export function MyWeekPageClient({
  firstName,
  todayLabel,
  dailyQuote,
  events,
  hasCalendarFeed,
  isAdmin,
  calendarError,
  tasks: initialTasks,
  honeyBookTasks = [],
  staffColors = [],
}: MyWeekPageClientProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          My Week
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Your week, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{todayLabel}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Approvals, packets, training, and handbook live in{" "}
          <Link
            href="/for-you"
            className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
          >
            For You
          </Link>
          .
        </p>
      </div>

      {dailyQuote ? (
        <section
          aria-label="Daily quote"
          className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm"
        >
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
              Today’s spark
            </p>
            <blockquote className="mt-2 text-base leading-relaxed text-[var(--foreground)] sm:text-lg">
              “{dailyQuote.text}”
            </blockquote>
            <p className="mt-2 text-sm text-[var(--muted)]">
              — {dailyQuote.author}
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            This Week&apos;s Events
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isAdmin
              ? "Next 7 days from the company calendar."
              : "Next 7 days from the shared HoneyBook calendar."}
          </p>

          {calendarError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              Couldn’t load events: {calendarError}
            </div>
          ) : !hasCalendarFeed ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                No calendar feed connected
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {isAdmin
                  ? "Add the company iCal URL on Calendar to see upcoming Events here."
                  : "Ask an admin to connect the HoneyBook calendar on Calendar."}
              </p>
            </div>
          ) : events.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                No Events this week
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Nothing on the calendar for the next 7 days.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {events.map((event) => {
                const staffColor = matchStaffColor(
                  event.assignedStaff,
                  staffColors,
                );
                return (
                <li
                  key={`${event.uid}-${event.start}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3"
                  style={
                    staffColor
                      ? {
                          borderLeftWidth: 4,
                          borderLeftColor: staffColor,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--foreground)]">
                        {event.eventType || event.title}
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">
                        {formatEventDate(event.start)}
                        {" · "}
                        {formatDescriptionTimeRange(event)}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                  {event.assignedStaff ? (
                    <p
                      className="mt-1 text-xs font-medium"
                      style={{ color: staffColor ?? "var(--muted)" }}
                    >
                      {event.assignedStaff}
                    </p>
                  ) : null}
                  {event.venue ? (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--muted)]">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{event.venue}</span>
                    </p>
                  ) : null}
                  {event.clientName ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Client: {event.clientName}
                    </p>
                  ) : null}
                  {event.clientContact ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Contact: {event.clientContact}
                    </p>
                  ) : null}
                  {event.clientPhone ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--foreground)]">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <a
                        href={`tel:${event.clientPhone}`}
                        className="font-medium hover:text-[var(--brand)]"
                      >
                        {event.clientPhone}
                      </a>
                    </p>
                  ) : null}
                  {event.clientEmail ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--foreground)]">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <a
                        href={`mailto:${event.clientEmail}`}
                        className="truncate font-medium hover:text-[var(--brand)]"
                      >
                        {event.clientEmail}
                      </a>
                    </p>
                  ) : null}
                  {event.planningFormUrl ||
                  event.eventUrl ||
                  (event.relatedFiles?.length ?? 0) > 0 ? (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {event.planningFormUrl ? (
                        <a
                          href={event.planningFormUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-[var(--brand)] hover:underline"
                        >
                          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                          Planning form
                        </a>
                      ) : null}
                      {(event.relatedFiles ?? [])
                        .filter(
                          (file) =>
                            file.url !== event.planningFormUrl &&
                            file.url !== event.eventUrl,
                        )
                        .map((file) => (
                          <a
                            key={file.url}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-[var(--brand)] hover:underline"
                          >
                            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                            {file.title}
                          </a>
                        ))}
                      {event.eventUrl ? (
                        <a
                          href={event.eventUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-[var(--brand)] hover:underline"
                        >
                          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                          Open event
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                </li>
                );
              })}
            </ul>
          )}
        </section>

        <TasksPanel initialTasks={initialTasks} />
      </div>

      <HoneyBookTasksPanel tasks={honeyBookTasks} />
    </div>
  );
}

function HoneyBookTasksPanel({ tasks }: { tasks: HoneyBookTask[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openTasks = useMemo(
    () => tasks.filter((t) => honeyBookTaskIsOpen(t)),
    [tasks],
  );
  const doneTasks = useMemo(
    () => tasks.filter((t) => !honeyBookTaskIsOpen(t)),
    [tasks],
  );

  function handleToggle(task: HoneyBookTask) {
    setError(null);
    const nextDone = honeyBookTaskIsOpen(task);
    startTransition(async () => {
      const result = await toggleHoneyBookTaskHubDoneAction(task.id, nextDone);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        HoneyBook tasks
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Tasks assigned to you in HoneyBook (via Zapier). Checking them off here
        only updates the Hub — complete them in HoneyBook to sync status back.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}

      {tasks.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-8 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">
            No HoneyBook tasks assigned to you
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ask an admin to add a HoneyBook → Zapier task Zap (see HoneyBook →
            Zapier setup). Your Hub email must match the HoneyBook assignee.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <HoneyBookTaskGroup
            label="To do"
            empty="You’re caught up on open HoneyBook tasks."
            tasks={openTasks}
            pending={pending}
            onToggle={handleToggle}
          />
          <HoneyBookTaskGroup
            label="Done"
            empty="Completed HoneyBook tasks will show up here."
            tasks={doneTasks}
            pending={pending}
            onToggle={handleToggle}
          />
        </div>
      )}
    </section>
  );
}

function HoneyBookTaskGroup({
  label,
  empty,
  tasks,
  pending,
  onToggle,
}: {
  label: string;
  empty: string;
  tasks: HoneyBookTask[];
  pending: boolean;
  onToggle: (task: HoneyBookTask) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
        <span className="ml-2 font-normal normal-case tracking-normal">
          ({tasks.length})
        </span>
      </p>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => {
            const isOpen = honeyBookTaskIsOpen(task);
            return (
              <li
                key={task.id}
                className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
              >
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onToggle(task)}
                  className={[
                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                    !isOpen
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--border)] text-transparent hover:border-[var(--brand)]",
                  ].join(" ")}
                  aria-label={isOpen ? "Mark as done in Hub" : "Mark as not done"}
                >
                  <Check className="h-3 w-3" />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-sm text-[var(--foreground)]",
                      !isOpen ? "line-through text-[var(--muted)]" : "",
                    ].join(" ")}
                  >
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {task.project_name ? `${task.project_name}` : "HoneyBook"}
                    {task.due_date
                      ? ` · Due ${new Date(`${task.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : ""}
                    {task.status === "done" && !task.hub_done
                      ? " · Done in HoneyBook"
                      : ""}
                    {task.hub_done ? " · Done in Hub" : ""}
                  </p>
                  {task.notes ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {task.notes}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TasksPanel({ initialTasks }: { initialTasks: Task[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openTasks = useMemo(
    () => initialTasks.filter((task) => !task.is_done),
    [initialTasks],
  );
  const doneTasks = useMemo(
    () => initialTasks.filter((task) => task.is_done),
    [initialTasks],
  );

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTaskAction(title, dueDate || null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDueDate("");
      router.refresh();
    });
  }

  function handleToggle(task: Task) {
    setError(null);
    startTransition(async () => {
      const result = await toggleTaskDoneAction(task.id, !task.is_done);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(task: Task) {
    setError(null);
    startTransition(async () => {
      const result = await deleteTaskAction(task.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">My Tasks</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Personal to-dos for the week. Only you can see these.
      </p>

      <form onSubmit={handleAdd} className="mt-4 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            aria-label="Due date (optional)"
          />
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
      </form>

      <div className="mt-5 space-y-5">
        <TaskGroup
          label="To do"
          empty="Nothing on your list yet — add a task above."
          tasks={openTasks}
          pending={pending}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
        <TaskGroup
          label="Completed"
          empty="Completed tasks will show up here."
          tasks={doneTasks}
          pending={pending}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>
    </section>
  );
}

function TaskGroup({
  label,
  empty,
  tasks,
  pending,
  onToggle,
  onDelete,
}: {
  label: string;
  empty: string;
  tasks: Task[];
  pending: boolean;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
        <span className="ml-2 font-normal normal-case tracking-normal">
          ({tasks.length})
        </span>
      </p>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
            >
              <button
                type="button"
                disabled={pending}
                onClick={() => onToggle(task)}
                className={[
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                  task.is_done
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[var(--border)] text-transparent hover:border-[var(--brand)]",
                ].join(" ")}
                aria-label={task.is_done ? "Mark as not done" : "Mark as done"}
              >
                <Check className="h-3 w-3" />
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={[
                    "text-sm text-[var(--foreground)]",
                    task.is_done ? "line-through text-[var(--muted)]" : "",
                  ].join(" ")}
                >
                  {task.title}
                </p>
                {task.due_date ? (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    Due{" "}
                    {new Date(`${task.due_date}T12:00:00`).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => onDelete(task)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-600 disabled:opacity-50"
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
