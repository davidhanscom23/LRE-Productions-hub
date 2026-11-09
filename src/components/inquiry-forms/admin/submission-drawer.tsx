"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Mail, Phone, ShieldAlert, ShieldCheck, UserPlus, X } from "lucide-react";
import {
  addSubmissionToCrm,
  getSubmissionDetail,
  setSubmissionSpam,
} from "@/app/(app)/inquiry-forms/actions";
import { formatEasternTimestamp } from "@/lib/inquiry-forms/dates";
import type { Qualification } from "@/lib/inquiry-forms/types";
import { useModalFocus } from "./list-modal-focus";
import { ModalPortal } from "./modal-portal";
import { Chip, cls, Notice } from "./list-ui";
import {
  DATE_RESULT_LABEL,
  DATE_RESULT_TONE,
  LOCATION_RESULT_LABEL,
  LOCATION_RESULT_TONE,
  LOG_STATUS_LABEL,
  LOG_STATUS_TONE,
  SCORE_LABEL_TEXT,
  SCORE_LABEL_TONE,
  STAGE_LABEL,
  STAGE_TONE,
  CRM_WORDS,
  attributionRows,
  formatYmd,
  logKindLabel,
  mailtoHref,
  splitAnswerLine,
} from "./submissions-format";
import type { SubmissionDetail } from "./submissions-types";

type Load = { state: "loading" } | { state: "error"; error: string } | { state: "ready"; detail: SubmissionDetail };

/**
 * One submission in a side drawer: answers, qualification, attribution, CRM link or CRM_WORDS.add,
 * spam toggle and the activity log. Mount with key={submissionId}. Closes with X or Escape only.
 * Rendered under <body> (ModalPortal) so the hub's skin art never paints over it.
 */
export function SubmissionDrawer(props: { submissionId: string; onClose: () => void; onChanged?: () => void }) {
  return (
    <ModalPortal>
      <DrawerPanel {...props} />
    </ModalPortal>
  );
}

function DrawerPanel({
  submissionId,
  onClose,
  onChanged,
}: {
  submissionId: string;
  onClose: () => void;
  /** Called after a change (spam flag, CRM record) so the list can refresh. */
  onChanged?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [flash, setFlash] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useModalFocus(true, panelRef, onClose, closeRef);

  useEffect(() => {
    let alive = true;
    getSubmissionDetail(submissionId)
      .then((res) => {
        if (!alive) return;
        setLoad(res.ok ? { state: "ready", detail: res.detail } : { state: "error", error: res.error });
      })
      .catch(() => {
        if (alive) setLoad({ state: "error", error: "Could not reach the Hub. Check your connection and try again." });
      });
    return () => {
      alive = false;
    };
  }, [submissionId]);

  async function reload() {
    try {
      const res = await getSubmissionDetail(submissionId);
      setLoad(res.ok ? { state: "ready", detail: res.detail } : { state: "error", error: res.error });
    } catch {
      setLoad({ state: "error", error: "Could not reach the Hub. Check your connection and try again." });
    }
  }

  function addToCrm() {
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await addSubmissionToCrm(submissionId);
        if (!res.ok) {
          setFlash({ tone: "bad", text: res.error });
          // Another write holds the card: show that state instead of the Add button.
          if (res.busy) await reload();
          return;
        }
        // Reload first: the success line shows with the updated record block, never beside the old one.
        await reload();
        setFlash({ tone: "good", text: res.already ? CRM_WORDS.already : CRM_WORDS.added });
        onChanged?.();
      } catch {
        setFlash({ tone: "bad", text: "Could not reach the Hub. Check your connection and try again." });
      }
    });
  }

  function markSpam(spam: boolean) {
    if (spam && !window.confirm(CRM_WORDS.spamConfirm)) return;
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await setSubmissionSpam(submissionId, spam);
        if (!res.ok) {
          setFlash({ tone: "bad", text: res.error || "That did not work. Please try again." });
          return;
        }
        await reload();
        setFlash({ tone: "good", text: spam ? "Marked as spam." : "Marked as not spam." });
        onChanged?.();
      } catch {
        setFlash({ tone: "bad", text: "Could not reach the Hub. Check your connection and try again." });
      }
    });
  }

  const d = load.state === "ready" ? load.detail : null;
  const heading = d ? d.contact.name || d.contact.email || d.contact.phone || "Visitor" : "Submission";

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Visual only: the drawer closes with X or Escape, never with an outside click. */}
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={load.state === "loading" || pending}
        tabIndex={-1}
        className="relative z-10 flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] backdrop-blur-md shadow-2xl sm:max-w-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-[var(--foreground)]">
              {heading}
            </h2>
            {d ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                <Chip tone={STAGE_TONE[d.stage]}>{STAGE_LABEL[d.stage]}</Chip>
                <span>{d.formName}</span>
              </p>
            ) : null}
          </div>
          <button ref={closeRef} type="button" className={cls.iconBtn} onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {load.state === "loading" ? (
            <p className="text-sm text-[var(--muted)]" role="status">
              Loading the answers, checks and activity for this submission...
            </p>
          ) : null}
          {load.state === "error" ? <Notice tone="bad" title="Could not open this submission">{load.error}</Notice> : null}

          <div aria-live="polite" className="empty:hidden">
            {flash ? <Notice tone={flash.tone}>{flash.text}</Notice> : null}
          </div>

          {d ? (
            <>
              <ContactBlock d={d} />
              <CrmBlock d={d} pending={pending} onAdd={addToCrm} />
              <Section title="Answers">
                {d.lines.length === 0 ? (
                  <p className={cls.help}>No answers saved yet.</p>
                ) : (
                  <dl className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                    {d.lines.map((line, i) => {
                      const { label, value } = splitAnswerLine(line);
                      return (
                        <div key={i} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-3">
                          <dt className="text-sm text-[var(--muted)]">{label || "Answer"}</dt>
                          <dd className="whitespace-pre-wrap break-words text-sm text-[var(--foreground)]">{value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </Section>
              <QualificationBlock q={d.qualification} score={d.score} scoreLabel={d.scoreLabel} />
              <AttributionBlock d={d} />
              <TimelineBlock d={d} />
              <LogBlock d={d} />
              <Section title="Spam">
                {d.stage === "spam" ? (
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--foreground)]">
                      {d.spamReason ? `Reason: ${d.spamReason}.` : "This submission is marked as spam."}{" "}
                      {d.crmHref ? CRM_WORDS.spamRecordStays : CRM_WORDS.spamNoRecord}
                    </p>
                    <button type="button" className={cls.btnSecondary} disabled={pending} onClick={() => markSpam(false)}>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Not spam
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className={cls.help}>Junk or a bot? Marking it keeps it out of the step-by-step funnel.</p>
                    <button type="button" className={cls.btnSecondary} disabled={pending} onClick={() => markSpam(true)}>
                      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                      Mark as spam
                    </button>
                  </div>
                )}
              </Section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      {children}
    </section>
  );
}

function ContactBlock({ d }: { d: SubmissionDetail }) {
  const { email, phone } = d.contact;
  return (
    <div className="flex flex-wrap gap-2">
      {email ? (
        <a href={mailtoHref(email)} className={cls.btnSmall}>
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="break-all">{email}</span>
        </a>
      ) : null}
      {phone ? (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={cls.btnSmall}>
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {phone}
        </a>
      ) : null}
      {d.eventDate ? (
        <span className="inline-flex min-h-9 items-center rounded-lg bg-[var(--background)] px-2.5 text-xs font-medium text-[var(--foreground)]">
          Event date: {formatYmd(d.eventDate)}
        </span>
      ) : null}
      {!email && !phone ? <p className={cls.help}>No email or phone yet.</p> : null}
    </div>
  );
}

function CrmBlock({ d, pending, onAdd }: { d: SubmissionDetail; pending: boolean; onAdd: () => void }) {
  if (d.crmHref) {
    return (
      <Link href={d.crmHref} className={cls.btnSecondary}>
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        {CRM_WORDS.open}
      </Link>
    );
  }
  if (d.stage === "spam") {
    return <p className={cls.help}>Spam never goes to {CRM_WORDS.name}. Choose Not spam below first if this is a real person.</p>;
  }
  const hasContact = Boolean(d.contact.email || d.contact.phone);
  if (!hasContact) {
    return <p className={cls.help}>There is no email or phone yet, so this cannot go to {CRM_WORDS.name}.</p>;
  }
  if (d.crmBusy) {
    return (
      <p className="text-sm text-[var(--foreground)]" role="status">
        {CRM_WORDS.busy}
      </p>
    );
  }
  if (!d.canAddToCrm) {
    return d.stage === "completed" || d.stage === "waitlisted" ? (
      <p className={cls.help}>The Hub is creating the {CRM_WORDS.name} card for this inquiry. Reopen this in a few minutes.</p>
    ) : null;
  }
  const why =
    d.stage === "completed" || d.stage === "waitlisted"
      ? `The ${CRM_WORDS.name} card for this inquiry was not created automatically. Add it now so nobody misses it.`
      : d.stage === "abandoned"
        ? `This visitor left partway. Add them to ${CRM_WORDS.name} to follow up with what they shared.`
        : `This visitor has not finished the form yet (they may still be on it). Add them to ${CRM_WORDS.name} now to follow up with what they shared so far.`;
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <p className="text-sm text-[var(--foreground)]">{why}</p>
      <button type="button" className={cls.btnPrimary} disabled={pending} onClick={onAdd} aria-busy={pending}>
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {pending ? CRM_WORDS.adding : CRM_WORDS.add}
      </button>
    </div>
  );
}

function QualificationBlock({
  q,
  score,
  scoreLabel,
}: {
  q: Qualification;
  score: number | null;
  scoreLabel: SubmissionDetail["scoreLabel"];
}) {
  const date = q?.date;
  const loc = q?.location;
  const budget = q?.budget;
  return (
    <Section title="Qualification">
      <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <Row label="Score">
          {score === null ? (
            <span className="text-sm text-[var(--muted)]">Not scored yet</span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
              <span className="font-semibold tabular-nums">{score}</span>
              {scoreLabel ? <Chip tone={SCORE_LABEL_TONE[scoreLabel]}>{SCORE_LABEL_TEXT[scoreLabel]}</Chip> : null}
            </span>
          )}
        </Row>
        <Row label="Date">
          {date ? (
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={DATE_RESULT_TONE[date.result]}>{DATE_RESULT_LABEL[date.result]}</Chip>
                {date.checkedFor ? <span className="text-[var(--foreground)]">{formatYmd(date.checkedFor)}</span> : null}
              </div>
              {date.message ? <p className="text-[var(--muted)]">Visitor saw: {date.message}</p> : null}
              {date.alternatives?.length ? (
                <p className="text-[var(--muted)]">Offered instead: {date.alternatives.map(formatYmd).join(", ")}</p>
              ) : null}
              {q.altDateChosen ? <p className="text-[var(--foreground)]">The visitor picked one of the other dates.</p> : null}
            </div>
          ) : (
            <span className="text-sm text-[var(--muted)]">Not checked</span>
          )}
        </Row>
        <Row label="Location">
          {loc ? (
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={LOCATION_RESULT_TONE[loc.result]}>{LOCATION_RESULT_LABEL[loc.result]}</Chip>
                {typeof loc.miles === "number" ? (
                  <span className="text-[var(--foreground)]">
                    {loc.miles.toFixed(1)} miles from home base <span className="text-[var(--muted)]">(staff only)</span>
                  </span>
                ) : null}
              </div>
              {loc.query ? <p className="text-[var(--muted)]">Looked up: {loc.query}</p> : null}
              {loc.confidence ? <p className="text-[var(--muted)]">Map match: {loc.confidence}</p> : null}
              {loc.message ? <p className="text-[var(--muted)]">Visitor saw: {loc.message}</p> : null}
            </div>
          ) : (
            <span className="text-sm text-[var(--muted)]">Not checked</span>
          )}
        </Row>
        <Row label="Budget">
          {budget ? (
            <span className="text-sm text-[var(--foreground)]">
              {budget.passed === true
                ? "Within the range we usually take"
                : budget.passed === false
                  ? "Below the range we usually take"
                  : "Skipped"}
              {typeof budget.amount === "number" ? ` (${budget.amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })})` : ""}
            </span>
          ) : (
            <span className="text-sm text-[var(--muted)]">Not asked</span>
          )}
        </Row>
      </div>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:gap-3">
      <div className="text-sm font-medium text-[var(--muted)]">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AttributionBlock({ d }: { d: SubmissionDetail }) {
  const rows = attributionRows(d.attribution);
  return (
    <Section title="Where they came from">
      {rows.length === 0 ? (
        <p className={cls.help}>No tracking details: they opened the form directly.</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
              <dt className="text-[var(--muted)]">{r.label}</dt>
              <dd className="min-w-0 break-all text-[var(--foreground)]">
                {r.href ? (
                  <a href={r.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}

function TimelineBlock({ d }: { d: SubmissionDetail }) {
  const items: { label: string; at: string | null }[] = [
    { label: "Started", at: d.startedAt },
    { label: "Last activity", at: d.lastActivityAt },
    { label: d.stage === "waitlisted" ? "Joined the waitlist" : "Sent", at: d.completedAt },
    { label: "Marked abandoned", at: d.abandonedAt },
  ];
  return (
    <Section title="Timeline">
      <dl className="space-y-1 text-sm">
        {items
          .filter((i) => i.at)
          .map((i) => (
            <div key={i.label} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
              <dt className="text-[var(--muted)]">{i.label}</dt>
              <dd className="text-[var(--foreground)]">{formatEasternTimestamp(i.at as string)}</dd>
            </div>
          ))}
        <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
          <dt className="text-[var(--muted)]">Furthest step</dt>
          <dd className="text-[var(--foreground)]">
            {Math.min(d.currentStep + 1, Math.max(d.totalSteps, 1))} of {Math.max(d.totalSteps, 1)}
          </dd>
        </div>
      </dl>
    </Section>
  );
}

function LogBlock({ d }: { d: SubmissionDetail }) {
  return (
    <Section title="Activity">
      {d.log.length === 0 ? (
        <p className={cls.help}>Nothing sent for this submission yet.</p>
      ) : (
        <ol className="space-y-2">
          {d.log.map((entry, i) => (
            <li key={i} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--foreground)]">{logKindLabel(entry.kind)}</span>
                <Chip tone={LOG_STATUS_TONE[entry.status] ?? "neutral"}>{LOG_STATUS_LABEL[entry.status] ?? entry.status}</Chip>
              </div>
              <p className="mt-0.5 text-[var(--muted)]">
                {formatEasternTimestamp(entry.at)}
                {entry.channel ? ` · ${entry.channel}` : ""}
                {entry.recipient ? ` · ${entry.recipient}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export default SubmissionDrawer;
