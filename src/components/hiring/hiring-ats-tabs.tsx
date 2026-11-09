"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  createInterviewAction,
  createTemplateAction,
  deleteInterviewAction,
  deleteTemplateAction,
  setInterviewStatusAction,
} from "@/app/(app)/hiring/ats-actions";
import type { Candidate } from "@/lib/types/hiring";
import type { HiringApplication } from "@/lib/types/hiring-applications";
import {
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TRACKS,
  type InterviewSchedule,
  type InterviewStatus,
  type InterviewTemplate,
} from "@/lib/types/hiring-ats";

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

/* ---------------- Dashboard ---------------- */

export function HiringDashboard({
  candidates,
  applications,
  interviews,
}: {
  candidates: Candidate[];
  applications: HiringApplication[] | null;
  interviews: InterviewSchedule[];
}) {
  const total = candidates.length;
  const newApplicants = (applications ?? []).filter(
    (a) => a.status === "pending",
  ).length;
  const inPipeline = candidates.filter(
    (c) => c.stage !== "hired" && c.stage !== "rejected",
  ).length;
  const hired = candidates.filter((c) => c.stage === "hired").length;

  const [now] = useState(() => Date.now());
  const upcoming = useMemo(() => {
    return interviews
      .filter(
        (i) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      )
      .slice(0, 6);
  }, [interviews, now]);

  const stats = [
    { label: "Total candidates", value: total, icon: Users },
    { label: "New applicants", value: newApplicants, icon: UserPlus },
    { label: "In pipeline", value: inPipeline, icon: TrendingUp },
    { label: "Hired", value: hired, icon: ClipboardList },
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
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <CalendarClock className="h-4 w-4" /> Upcoming interviews
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No interviews scheduled. Add one from the Schedule tab.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {i.candidate_name ?? "Candidate"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatWhen(i.scheduled_at)}
                    {i.interviewer ? ` · ${i.interviewer}` : ""}
                    {i.location ? ` · ${i.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Schedule ---------------- */

export function HiringSchedule({
  candidates,
  interviews,
}: {
  candidates: Candidate[];
  interviews: InterviewSchedule[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [when, setWhen] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  function add() {
    setError(null);
    startTransition(async () => {
      const r = await createInterviewAction({
        candidateId,
        scheduledAt: when,
        interviewer,
        location,
        notes,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      setCandidateId("");
      setWhen("");
      setInterviewer("");
      setLocation("");
      setNotes("");
      router.refresh();
    });
  }

  const sorted = [...interviews].sort(
    (a, b) =>
      new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
  );

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Schedule an interview
        </h2>
        <div className="mt-3 space-y-2">
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className={inputCls}
          >
            <option value="">Choose candidate…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.job_title ? ` · ${c.job_title}` : ""}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className={inputCls}
            />
            <input
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="Interviewer"
              className={inputCls}
            />
          </div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location / video link"
            className={inputCls}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={pending || !candidateId || !when}
            onClick={add}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No interviews yet.</p>
        </Card>
      ) : (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            All interviews
          </h2>
          <ul className="mt-3 space-y-2">
            {sorted.map((i) => (
              <InterviewRow key={i.id} interview={i} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function InterviewRow({ interview }: { interview: InterviewSchedule }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(status: InterviewStatus) {
    startTransition(async () => {
      await setInterviewStatusAction(interview.id, status);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("Delete this interview?")) return;
    startTransition(async () => {
      await deleteInterviewAction(interview.id);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {interview.candidate_name ?? "Candidate"}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatWhen(interview.scheduled_at)}
          {interview.interviewer ? ` · ${interview.interviewer}` : ""}
          {interview.location ? ` · ${interview.location}` : ""}
        </p>
        {interview.notes ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{interview.notes}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <select
          value={interview.status}
          disabled={pending}
          onChange={(e) => setStatus(e.target.value as InterviewStatus)}
          className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]"
        >
          {(Object.keys(INTERVIEW_STATUS_LABELS) as InterviewStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {INTERVIEW_STATUS_LABELS[s]}
              </option>
            ),
          )}
        </select>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded p-1 text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
          aria-label="Delete interview"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

/* ---------------- Templates ---------------- */

export function HiringTemplates({
  templates,
}: {
  templates: InterviewTemplate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [track, setTrack] = useState("general");
  const [questions, setQuestions] = useState("");

  function add() {
    setError(null);
    startTransition(async () => {
      const r = await createTemplateAction({
        title,
        track,
        questions: questions.split("\n"),
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      setTitle("");
      setTrack("general");
      setQuestions("");
      router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    startTransition(async () => {
      await deleteTemplateAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          New interview template
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Reusable questionnaires and scorecards. One question per line.
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Template title (e.g. AV tech phone screen)"
              className={inputCls}
            />
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              className={inputCls}
            >
              {INTERVIEW_TRACKS.map((t) => (
                <option key={t} value={t}>
                  {t === "general" ? "General" : t}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={6}
            placeholder={"Tell me about a tough crowd you turned around.\nHow do you handle a last-minute timeline change?"}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={add}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Save template
          </button>
        </div>
      </Card>

      {templates.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No templates yet.</p>
        </Card>
      ) : (
        templates.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
                  <FileText className="h-4 w-4 text-[var(--brand)]" />
                  {t.title}
                </h3>
                <span className="text-xs text-[var(--muted)]">
                  {t.track === "general" ? "General" : t.track}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="rounded p-1 text-[var(--muted)] hover:text-red-600"
                aria-label="Delete template"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {t.questions.length > 0 ? (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--foreground)]">
                {t.questions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No questions.</p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
