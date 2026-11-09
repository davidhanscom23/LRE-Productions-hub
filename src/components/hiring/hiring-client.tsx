"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCandidateAction,
  createJobAction,
  deleteCandidateAction,
  deleteJobAction,
  promoteApplicationAction,
  setApplicationStatusAction,
  setJobStatusAction,
  updateCandidateAction,
  updateCandidateStageAction,
} from "@/app/(app)/hiring/actions";
import {
  CANDIDATE_STAGES,
  HIRING_DEPARTMENTS,
  stageLabel,
  type Candidate,
  type CandidateStage,
  type JobOpening,
} from "@/lib/types/hiring";
import type { HiringApplication } from "@/lib/types/hiring-applications";
import { getApplyTrack } from "@/lib/hiring/apply-tracks";
import type {
  InterviewSchedule,
  InterviewTemplate,
} from "@/lib/types/hiring-ats";
import {
  HiringDashboard,
  HiringSchedule,
  HiringTemplates,
} from "@/components/hiring/hiring-ats-tabs";

type HiringTab = "dashboard" | "pipeline" | "schedule" | "templates";

const HIRING_TABS: { id: HiringTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pipeline", label: "Pipeline" },
  { id: "schedule", label: "Schedule" },
  { id: "templates", label: "Templates" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]";

function CandidateCard({
  c,
  jobs,
}: {
  c: Candidate;
  jobs: JobOpening[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(c.full_name);
  const [email, setEmail] = useState(c.email);
  const [phone, setPhone] = useState(c.phone);
  const [jobId, setJobId] = useState(c.job_id ?? "");
  const [stage, setStage] = useState<CandidateStage>(c.stage);
  const [notes, setNotes] = useState(c.notes);

  function moveStage(next: string) {
    startTransition(async () => {
      const r = await updateCandidateStageAction({ id: c.id, stage: next });
      if (r.error) {
        alert(r.error);
        return;
      }
      if (next === "hired" && r.onboardingPlanId) {
        const inviteNote = r.invited
          ? " Hub invite email sent."
          : r.inviteError
            ? ` Invite note: ${r.inviteError}`
            : c.email
              ? " Linked or ready for Hub account."
              : " Add an email next time to auto-invite.";
        if (
          confirm(
            `${c.full_name} is hired — onboarding plan ready.${inviteNote} Open Onboarding now?`,
          )
        ) {
          router.push("/onboarding");
          return;
        }
      }
      router.refresh();
    });
  }
  function save() {
    startTransition(async () => {
      const r = await updateCandidateAction({
        id: c.id,
        fullName,
        email,
        phone,
        jobId: jobId || null,
        stage,
        notes,
      });
      if (r.error) {
        alert(r.error);
        return;
      }
      setEditing(false);
      if (stage === "hired" && r.onboardingPlanId) {
        const inviteNote = r.invited
          ? " Hub invite email sent."
          : r.inviteError
            ? ` Invite note: ${r.inviteError}`
            : email
              ? " Linked or ready for Hub account."
              : " Add an email to auto-invite.";
        if (
          confirm(
            `${fullName} is hired — onboarding plan ready.${inviteNote} Open Onboarding now?`,
          )
        ) {
          router.push("/onboarding");
          return;
        }
      }
      router.refresh();
    });
  }
  function remove() {
    if (!confirm(`Delete ${c.full_name}?`)) return;
    startTransition(async () => {
      const r = await deleteCandidateAction(c.id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-[var(--brand)]/40 bg-[var(--background)] p-3 space-y-2">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Name" className={inputCls} />
        <div className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputCls} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={inputCls} />
        </div>
        <div className="flex gap-2">
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputCls}>
            <option value="">No opening</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
          <select value={stage} onChange={(e) => setStage(e.target.value as CandidateStage)} className={inputCls}>
            {CANDIDATE_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
        <div className="flex gap-2">
          <button type="button" disabled={pending || !fullName.trim()} onClick={save} className="inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)]">Cancel</button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">{c.full_name}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[var(--muted)]">
            {c.email ? <span>{c.email}</span> : null}
            {c.phone ? <span>{c.phone}</span> : null}
            {c.job_title ? <span>· {c.job_title}</span> : null}
          </div>
          {c.notes ? <p className="mt-1 text-sm text-[var(--muted)]">{c.notes}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={c.stage}
            disabled={pending}
            onChange={(e) => moveStage(e.target.value)}
            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          >
            {CANDIDATE_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-xs">
        <button type="button" onClick={() => setEditing(true)} className="text-[var(--muted)] hover:text-[var(--foreground)]">Edit</button>
        <button type="button" onClick={remove} className="text-[var(--muted)] hover:text-red-600">Delete</button>
      </div>
    </li>
  );
}

export function HiringClient({
  jobs,
  candidates,
  applications,
  applicationsError,
  interviews = [],
  templates = [],
}: {
  jobs: JobOpening[];
  candidates: Candidate[];
  applications: HiringApplication[] | null;
  applicationsError: string | null;
  interviews?: InterviewSchedule[];
  templates?: InterviewTemplate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [promoteJobId, setPromoteJobId] = useState("");
  const [tab, setTab] = useState<HiringTab>("dashboard");

  // Job form
  const [jTitle, setJTitle] = useState("");
  const [jDept, setJDept] = useState("");
  const [jDesc, setJDesc] = useState("");

  // Candidate form
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cJob, setCJob] = useState("");
  const [cStage, setCStage] = useState<CandidateStage>("applied");
  const [cNotes, setCNotes] = useState("");

  const countByJob = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of candidates) {
      if (c.job_id) m.set(c.job_id, (m.get(c.job_id) ?? 0) + 1);
    }
    return m;
  }, [candidates]);

  const byStage = useMemo(() => {
    const m = new Map<CandidateStage, Candidate[]>();
    for (const s of CANDIDATE_STAGES) m.set(s.value, []);
    for (const c of candidates) m.get(c.stage)?.push(c);
    return m;
  }, [candidates]);

  const pendingApps = (applications ?? []).filter((a) => a.status === "pending");

  function createJob() {
    setError(null);
    startTransition(async () => {
      const r = await createJobAction({ title: jTitle, department: jDept, description: jDesc });
      if (r.error) { setError(r.error); return; }
      setJTitle(""); setJDept(""); setJDesc("");
      router.refresh();
    });
  }
  function toggleJob(job: JobOpening) {
    startTransition(async () => {
      await setJobStatusAction({ jobId: job.id, status: job.status === "open" ? "closed" : "open" });
      router.refresh();
    });
  }
  function removeJob(job: JobOpening) {
    if (!confirm(`Delete "${job.title}"? Candidates stay but lose the link.`)) return;
    startTransition(async () => {
      const r = await deleteJobAction(job.id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function addCandidate() {
    setError(null);
    startTransition(async () => {
      const r = await createCandidateAction({
        fullName: cName, email: cEmail, phone: cPhone,
        jobId: cJob || null, stage: cStage, notes: cNotes,
      });
      if (r.error) { setError(r.error); return; }
      setCName(""); setCEmail(""); setCPhone(""); setCJob(""); setCStage("applied"); setCNotes("");
      router.refresh();
    });
  }
  function promote(app: HiringApplication) {
    startTransition(async () => {
      const r = await promoteApplicationAction({
        applicationId: app.id,
        jobId: promoteJobId || null,
      });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function setAppStatus(app: HiringApplication, status: "archived" | "rejected") {
    startTransition(async () => {
      const r = await setApplicationStatusAction({
        applicationId: app.id,
        status,
      });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Hiring</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Vident Productions&rsquo;s hiring operating system. Admin-only. Public
          intake lives at <code className="text-xs">/apply</code>.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Hiring sections"
        className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
      >
        {HIRING_TABS.map((t) => {
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
        <HiringDashboard
          candidates={candidates}
          applications={applications}
          interviews={interviews}
        />
      ) : null}

      {tab === "schedule" ? (
        <HiringSchedule candidates={candidates} interviews={interviews} />
      ) : null}

      {tab === "templates" ? (
        <HiringTemplates templates={templates} />
      ) : null}

      {tab === "pipeline" ? (
        <>
      {/* Public applications */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Public applications
          {pendingApps.length > 0 ? (
            <span className="ml-2 text-[var(--muted)]">{pendingApps.length} pending</span>
          ) : null}
        </h2>
        {applicationsError ? (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">
              Public applications need a one-time database setup
            </p>
            <p>
              In Supabase → SQL Editor, paste and run{" "}
              <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                supabase/migrations/067_hiring_applications.sql
              </code>
              , then refresh this page. Job openings and candidates still work
              without it.
            </p>
            <p className="text-xs opacity-80">{applicationsError}</p>
          </div>
        ) : pendingApps.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No pending applications from /apply.
          </p>
        ) : (
          <>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[var(--muted)]">
                Link to opening when promoting
              </label>
              <select
                value={promoteJobId}
                onChange={(e) => setPromoteJobId(e.target.value)}
                className={inputCls}
              >
                <option value="">No opening</option>
                {jobs.filter((j) => j.status === "open").map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
            <ul className="mt-3 space-y-2">
              {pendingApps.map((app) => (
                <li
                  key={app.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
                >
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {app.full_name}
                    {app.role_interest ? (
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {app.role_interest}
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[var(--muted)]">
                    {app.email ? <span>{app.email}</span> : null}
                    {app.phone ? <span>{app.phone}</span> : null}
                    <span>
                      {new Date(app.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {app.message ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">{app.message}</p>
                  ) : null}
                  {app.assessment_track &&
                  app.assessment_answers &&
                  Object.keys(app.assessment_answers).length > 0 ? (
                    <details className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">
                        Working-style assessment
                        {getApplyTrack(app.assessment_track)
                          ? ` · ${getApplyTrack(app.assessment_track)!.shortLabel}`
                          : ""}
                      </summary>
                      <ul className="mt-2 space-y-2 text-xs text-[var(--muted)]">
                        {(getApplyTrack(app.assessment_track)?.questions ?? []).map(
                          (q) => {
                            const optId = app.assessment_answers[q.id];
                            const opt = q.options.find((o) => o.id === optId);
                            if (!opt) return null;
                            return (
                              <li key={q.id}>
                                <p className="font-medium text-[var(--foreground)]">
                                  {q.prompt}
                                </p>
                                <p className="mt-0.5">{opt.label}</p>
                              </li>
                            );
                          },
                        )}
                      </ul>
                    </details>
                  ) : null}
                  {app.resume_url ? (
                    <a
                      href={app.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-[var(--brand)] hover:underline"
                    >
                      Resume / portfolio
                    </a>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => promote(app)}
                      className="font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                    >
                      Promote to candidate
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setAppStatus(app, "rejected")}
                      className="text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setAppStatus(app, "archived")}
                      className="text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      Archive
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Openings */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Job openings</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={jTitle} onChange={(e) => setJTitle(e.target.value)} placeholder="Role title (e.g. AV Technician)" className={inputCls} />
          <select value={jDept} onChange={(e) => setJDept(e.target.value)} className={inputCls}>
            <option value="">Department…</option>
            {HIRING_DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </div>
        <textarea value={jDesc} onChange={(e) => setJDesc(e.target.value)} rows={2} placeholder="Description (optional)" className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
        <button type="button" disabled={pending || !jTitle.trim()} onClick={createJob} className="mt-2 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Add opening</button>

        {jobs.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {j.title}
                    {j.department ? <span className="text-[var(--muted)]"> · {j.department}</span> : null}
                    {j.status === "closed" ? <span className="ml-2 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--muted)]">Closed</span> : null}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{countByJob.get(j.id) ?? 0} candidate(s)</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => toggleJob(j)} className="text-[var(--muted)] hover:text-[var(--foreground)]">{j.status === "open" ? "Close" : "Reopen"}</button>
                  <button type="button" onClick={() => removeJob(j)} className="text-[var(--muted)] hover:text-red-600">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* Add candidate */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Add candidate</h2>
        <div className="mt-3 space-y-2">
          <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Full name" className={inputCls} />
          <div className="flex flex-wrap gap-2">
            <input value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="Email" className={inputCls} />
            <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="Phone" className={inputCls} />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={cJob} onChange={(e) => setCJob(e.target.value)} className={inputCls}>
              <option value="">No opening</option>
              {jobs.map((j) => (<option key={j.id} value={j.id}>{j.title}</option>))}
            </select>
            <select value={cStage} onChange={(e) => setCStage(e.target.value as CandidateStage)} className={inputCls}>
              {CANDIDATE_STAGES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </div>
          <textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
        </div>
        {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <button type="button" disabled={pending || !cName.trim()} onClick={addCandidate} className="mt-2 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Add candidate</button>
      </Card>

      {/* Pipeline */}
      {candidates.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No candidates yet.</p>
        </Card>
      ) : (
        CANDIDATE_STAGES.map((s) => {
          const list = byStage.get(s.value) ?? [];
          if (list.length === 0) return null;
          return (
            <Card key={s.value}>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {stageLabel(s.value)}
                <span className="ml-2 text-[var(--muted)]">{list.length}</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {list.map((c) => (<CandidateCard key={c.id} c={c} jobs={jobs} />))}
              </ul>
            </Card>
          );
        })
      )}
        </>
      ) : null}
    </div>
  );
}
