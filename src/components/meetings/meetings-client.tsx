"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gauge,
  ListChecks,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  addActionItemAction,
  analyzeMeetingAction,
  createMeetingAction,
  deleteActionItemAction,
  deleteMeetingAction,
  setActionItemStatusAction,
} from "@/app/(app)/meetings/actions";
import type {
  MeetingActionItemRow,
  MeetingNote,
  MeetingNoteListItem,
} from "@/lib/types/meeting-notes";

type Tab = "dashboard" | "meetings" | "actions";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "meetings", label: "All Meetings" },
  { id: "actions", label: "Action Items" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MeetingsClient({
  meetings,
  actionItems,
  selected,
  aiReady,
}: {
  meetings: MeetingNoteListItem[];
  actionItems: MeetingActionItemRow[];
  selected: MeetingNote | null;
  aiReady: boolean;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [adding, setAdding] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Meetings
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Meeting intelligence &amp; accountability. Paste a transcript and
              the Hub summarizes it, scores it, and pulls out action items.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add meeting
        </button>
      </header>

      {!aiReady ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          AI analysis isn’t configured yet (missing <code>OPENAI_API_KEY</code>).
          You can still add meetings; analysis will work once the key is set.
        </div>
      ) : null}

      <div
        role="tablist"
        className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" ? (
        <Dashboard meetings={meetings} actionItems={actionItems} />
      ) : null}
      {tab === "meetings" ? (
        <AllMeetings meetings={meetings} selected={selected} aiReady={aiReady} />
      ) : null}
      {tab === "actions" ? (
        <ActionItems actionItems={actionItems} />
      ) : null}

      {adding ? <AddMeetingModal onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

function Dashboard({
  meetings,
  actionItems,
}: {
  meetings: MeetingNoteListItem[];
  actionItems: MeetingActionItemRow[];
}) {
  const [now] = useState(() => todayKey());
  const [nowMs] = useState(() => Date.now());

  const analyzed = meetings.filter((m) => m.analyzed_at);
  const scored = analyzed.filter((m) => typeof m.quality_score === "number");
  const avg =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, m) => s + (m.quality_score ?? 0), 0) / scored.length,
        )
      : null;

  const analyzed30 = analyzed.filter((m) => {
    if (!m.analyzed_at) return false;
    const days = (nowMs - new Date(m.analyzed_at).getTime()) / 86400000;
    return days <= 30;
  }).length;

  const open = actionItems.filter((a) => a.status === "open");
  const overdue = open.filter((a) => a.due_date && a.due_date < now).length;

  const stats = [
    { label: "Avg quality score", value: avg === null ? "—" : `${avg}`, icon: Gauge },
    { label: "Analyzed (30 days)", value: `${analyzed30}`, icon: Sparkles },
    { label: "Open action items", value: `${open.length}`, icon: ListChecks },
    { label: "Overdue", value: `${overdue}`, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {s.label}
              </span>
              <s.icon className="h-4 w-4 text-[var(--brand)]" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Recent meetings
        </h2>
        {meetings.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No meetings yet. Add your first transcript to get started.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {meetings.slice(0, 8).map((m) => (
              <li key={m.id}>
                <Link
                  href={`/meetings?id=${m.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 hover:border-[var(--brand)]/40"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {m.title}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {m.meeting_date ?? "No date"}
                      {m.analyzed_at ? " · Analyzed" : " · Not analyzed"}
                    </p>
                  </div>
                  <ScorePill score={m.quality_score} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------- All Meetings ---------------- */

function AllMeetings({
  meetings,
  selected,
  aiReady,
}: {
  meetings: MeetingNoteListItem[];
  selected: MeetingNote | null;
  aiReady: boolean;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          All meetings
          <span className="ml-2 text-[var(--muted)]">{meetings.length}</span>
        </h2>
        {meetings.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No meetings yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {meetings.map((m) => {
              const active = selected?.id === m.id;
              return (
                <li key={m.id}>
                  <Link
                    href={`/meetings?id=${m.id}`}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                      active
                        ? "bg-[var(--brand)]/10 text-[var(--foreground)]"
                        : "text-[var(--foreground)] hover:bg-[var(--background)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-medium">{m.title}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {m.meeting_date ?? "No date"}
                      </span>
                    </span>
                    <ScorePill score={m.quality_score} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {selected ? (
        <MeetingDetail meeting={selected} aiReady={aiReady} />
      ) : (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Select a meeting to see its analysis.
          </p>
        </Card>
      )}
    </div>
  );
}

function MeetingDetail({
  meeting,
  aiReady,
}: {
  meeting: MeetingNote;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showTranscript, setShowTranscript] = useState(false);
  const strengths = meeting.analysis?.strengths ?? [];
  const improvements = meeting.analysis?.improvements ?? [];

  function reanalyze() {
    startTransition(async () => {
      const r = await analyzeMeetingAction(meeting.id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function remove() {
    if (!confirm("Delete this meeting and its action items?")) return;
    startTransition(async () => {
      const r = await deleteMeetingAction(meeting.id);
      if (r.error) alert(r.error);
      else router.push("/meetings");
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {meeting.title}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {meeting.meeting_date ?? "No date"}
            {meeting.analyzed_at
              ? ` · Analyzed ${new Date(meeting.analyzed_at).toLocaleDateString()}`
              : " · Not analyzed yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScorePill score={meeting.quality_score} large />
          <button
            type="button"
            onClick={reanalyze}
            disabled={pending || !aiReady}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {meeting.analyzed_at ? "Re-analyze" : "Analyze"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
            aria-label="Delete meeting"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {meeting.summary ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Summary
          </h3>
          <p className="mt-1 text-sm text-[var(--foreground)]">{meeting.summary}</p>
        </div>
      ) : null}

      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                What went well
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[var(--foreground)]">
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {improvements.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                To improve
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[var(--foreground)]">
                {improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <MeetingActionItems meetingId={meeting.id} />

      {meeting.transcript ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
          {showTranscript ? (
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--foreground)]">
              {meeting.transcript}
            </pre>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** Action items belonging to one meeting (inside the detail panel). */
function MeetingActionItems({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");

  function add() {
    startTransition(async () => {
      const r = await addActionItemAction({
        meetingId,
        text,
        owner,
        dueDate: due || null,
      });
      if (r.error) {
        alert(r.error);
        return;
      }
      setText("");
      setOwner("");
      setDue("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Add an action item
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Follow-up…"
          className="h-9 min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner"
          className="h-9 w-28 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={add}
          className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/* ---------------- Action Items tab ---------------- */

function ActionItems({ actionItems }: { actionItems: MeetingActionItemRow[] }) {
  const [now] = useState(() => todayKey());
  const open = actionItems.filter((a) => a.status === "open");
  const done = actionItems.filter((a) => a.status === "done");

  const sortedOpen = useMemo(() => {
    return [...open].sort((a, b) => {
      const ad = a.due_date ?? "9999";
      const bd = b.due_date ?? "9999";
      return ad.localeCompare(bd);
    });
  }, [open]);

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Open action items
          <span className="ml-2 text-[var(--muted)]">{open.length}</span>
        </h2>
        {sortedOpen.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing open. 🎉</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sortedOpen.map((a) => (
              <ActionRow key={a.id} item={a} overdue={Boolean(a.due_date && a.due_date < now)} />
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Completed
            <span className="ml-2 text-[var(--muted)]">{done.length}</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {done.map((a) => (
              <ActionRow key={a.id} item={a} overdue={false} />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function ActionRow({
  item,
  overdue,
}: {
  item: MeetingActionItemRow;
  overdue: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const done = item.status === "done";

  function toggle() {
    startTransition(async () => {
      await setActionItemStatusAction(item.id, done ? "open" : "done");
      router.refresh();
    });
  }
  function remove() {
    startTransition(async () => {
      await deleteActionItemAction(item.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="mt-0.5 text-[var(--muted)] hover:text-[var(--brand)] disabled:opacity-50"
          aria-label={done ? "Reopen" : "Mark done"}
        >
          <CheckCircle2
            className={`h-5 w-5 ${done ? "text-[var(--brand)]" : ""}`}
          />
        </button>
        <div>
          <p
            className={`text-sm ${
              done
                ? "text-[var(--muted)] line-through"
                : "font-medium text-[var(--foreground)]"
            }`}
          >
            {item.text}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
            {item.owner ? <span>{item.owner}</span> : null}
            {item.due_date ? (
              <span
                className={
                  overdue ? "font-medium text-red-600 dark:text-red-400" : ""
                }
              >
                <CalendarClock className="mr-0.5 inline h-3 w-3" />
                {item.due_date}
                {overdue ? " · overdue" : ""}
              </span>
            ) : null}
            {item.meeting_title ? <span>· {item.meeting_title}</span> : null}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded p-1 text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

/* ---------------- Add meeting ---------------- */

function AddMeetingModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [transcript, setTranscript] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createMeetingAction({
        title,
        meetingDate: date || null,
        transcript,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      onClose();
      router.push(`/meetings?id=${r.id ?? ""}`);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Add meeting
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title (e.g. Weekly leadership)"
              className="h-9 min-w-[14rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={10}
            placeholder="Paste the meeting transcript or notes here. On save, the Hub analyzes it automatically."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !title.trim()}
              onClick={submit}
              className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Analyzing…" : "Save & analyze"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */

function ScorePill({
  score,
  large,
}: {
  score: number | null;
  large?: boolean;
}) {
  if (score === null || score === undefined) {
    return (
      <span
        className={`shrink-0 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-xs font-medium text-[var(--muted)] ${
          large ? "px-3 py-1 text-sm" : ""
        }`}
      >
        —
      </span>
    );
  }
  const tone =
    score >= 75
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : score >= 50
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone} ${
        large ? "px-3 py-1 text-sm" : ""
      }`}
    >
      {score}
    </span>
  );
}
