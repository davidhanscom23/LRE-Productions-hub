"use client";

/**
 * Inquiry Forms public renderer - the availability reveal on a qualify step.
 *
 * The SERVER decides every verdict (one qualify call, started by the FormRenderer when the step opens);
 * this component only stages it: one box per configured check (date, then location), each "checking"
 * with rotating loading messages for at least minCheckMs and until the verdict arrives, then the result in
 * honest colors (green good, amber caution, red not possible, slate unknown) with the server's message.
 * Celebration (confetti + popup) only when the server says so. Under prefers-reduced-motion there is no
 * staging: results show as soon as they arrive, the celebration message stays as a static banner.
 * `onRevealed` fires once when the visitor may move on (Next appears, the unavailable dialog may open).
 */
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleAlert,
  CircleHelp,
  CircleX,
  Clock,
  Info,
  LoaderCircle,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import type {
  Answers,
  CheckKind,
  DateVerdict,
  FieldDef,
  FormDefinition,
  LocationVerdict,
  PublicFormSettings,
  StepDef,
} from "@/lib/inquiry-forms/types";
import { findRoleField } from "@/lib/inquiry-forms/definition";
import { formatLongDate, isValidDateString } from "@/lib/inquiry-forms/dates";
import { DATE_LOADING_MESSAGES, LOCATION_LOADING_MESSAGES } from "@/lib/inquiry-forms/defaults";
import { Confetti } from "./Confetti";
import { ReferralPanel, usableReferralLinks } from "./ReferralPanel";
import { dateTone, locationTone, type QualifyResult, type Tone } from "./flow";

export interface QualifyRun {
  /** Increments per run; the reveal is keyed by it so a re-check restarts the staging. */
  id: number;
  stepId: string;
  /** qualifyKey() of the answers this run checks. */
  key: string;
  status: "pending" | "done" | "error";
  result: QualifyResult | null;
  error: string | null;
  /** false = cached result shown statically (returning to the step). */
  animate: boolean;
  /** The visitor may continue (Next visible). */
  revealed: boolean;
}

const GAP_MS = 450;

function ms(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 20000) : fallback;
}

function choiceLabel(field: FieldDef, value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const c = (field.choices ?? []).find((x) => x.value === value);
  return c ? c.label : value;
}

function checkCopy(kind: CheckKind, def: FormDefinition, answers: Answers, verdict: DateVerdict | LocationVerdict | undefined) {
  if (kind === "date") {
    const f = findRoleField(def, "event_date");
    const checked = (verdict as DateVerdict | undefined)?.checkedFor ?? (f ? answers[f.key] : null);
    const value = typeof checked === "string" && isValidDateString(checked) ? formatLongDate(checked) : "No date given";
    return { label: f?.label?.trim() || "Event date", value };
  }
  const f = findRoleField(def, "event_location");
  const value = (f ? choiceLabel(f, answers[f.key]) : null) ?? "No location given";
  return { label: f?.label?.trim() || "Event location", value };
}

const FALLBACK_MESSAGE: Record<Tone, string> = {
  good: "Looks good.",
  caution: "We'll go over the details with you.",
  bad: "This one doesn't work as entered.",
  unknown: "We'll confirm this with you.",
};

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === "good") return <Check size={22} aria-hidden="true" />;
  if (tone === "caution") return <TriangleAlert size={22} aria-hidden="true" />;
  if (tone === "bad") return <CircleX size={22} aria-hidden="true" />;
  return <CircleHelp size={22} aria-hidden="true" />;
}

function RotatingMessage({ messages, intervalMs }: { messages: string[]; intervalMs: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2 || intervalMs <= 0) return;
    const t = setInterval(() => setI((v) => (v + 1) % messages.length), intervalMs);
    return () => clearInterval(t);
  }, [messages.length, intervalMs]);
  return <span aria-hidden="true">{messages[i % messages.length]}</span>;
}

type BoxState = "pending" | "checking" | "done";

function CheckBox({
  kind,
  label,
  value,
  state,
  tone,
  message,
  loading,
  intervalMs,
  rotate,
}: {
  kind: CheckKind;
  label: string;
  value: string;
  state: BoxState;
  tone: Tone | null;
  message: string;
  loading: string[];
  intervalMs: number;
  rotate: boolean;
}) {
  const icon =
    state === "done" && tone ? (
      <ToneIcon tone={tone} />
    ) : state === "checking" ? (
      <LoaderCircle size={22} className="iqf-spin" aria-hidden="true" />
    ) : kind === "date" ? (
      <CalendarDays size={22} aria-hidden="true" />
    ) : (
      <MapPin size={22} aria-hidden="true" />
    );
  return (
    <div className="iqf-check" data-state={state} data-tone={state === "done" && tone ? tone : undefined}>
      <span className="iqf-check-icon">{icon}</span>
      <div>
        <p className="iqf-check-label">{label}</p>
        <p className="iqf-check-value">{value}</p>
        <p className="iqf-check-status">
          {state === "done" ? (
            message
          ) : state === "checking" ? (
            rotate ? (
              <RotatingMessage messages={loading} intervalMs={intervalMs} />
            ) : (
              <span aria-hidden="true">{loading[0]}</span>
            )
          ) : (
            "Up next"
          )}
        </p>
      </div>
    </div>
  );
}

export function QualifyReveal({
  step,
  def,
  answers,
  settings,
  run,
  reducedMotion,
  confettiColors,
  onRevealed,
  onRetry,
}: {
  step: StepDef;
  def: FormDefinition;
  answers: Answers;
  settings: PublicFormSettings;
  run: QualifyRun;
  reducedMotion: boolean;
  confettiColors: string[];
  onRevealed: () => void;
  onRetry: () => void;
}) {
  const checks: CheckKind[] = [];
  for (const c of step.checks ?? []) {
    if ((c === "date" || c === "location") && !checks.includes(c)) checks.push(c);
  }
  const n = checks.length;
  const q = settings.qualify;
  const timings = q?.timings;
  const minCheckMs = ms(timings?.minCheckMs, 2500);
  const intervalMs = ms(timings?.messageIntervalMs, 2200);
  const preCelebrationMs = ms(timings?.preCelebrationMs, 900);
  const popupMs = ms(timings?.popupMs, 3200);
  // The pause between boxes follows the form's own pacing (minCheckMs 0 = no staging at all).
  const gapMs = Math.min(GAP_MS, minCheckMs);
  const animate = run.animate && !reducedMotion;
  const ready = run.status !== "pending";
  const done = run.status === "done";

  const [timersDone, setTimersDone] = useState(animate ? 0 : n);
  const [gapsDone, setGapsDone] = useState(animate ? 0 : n);
  const [celebrating, setCelebrating] = useState(false);
  const [popupLeaving, setPopupLeaving] = useState(false);
  const [popupGone, setPopupGone] = useState(false);

  const onRevealedRef = useRef(onRevealed);
  useEffect(() => {
    onRevealedRef.current = onRevealed;
  });
  const revealedSent = useRef(false);

  // Box k runs its minimum "checking" time once the previous box is revealed and the gap has passed.
  const k = Math.min(timersDone, n);
  const boxStarted = k < n && (k === 0 || (done && gapsDone >= k));
  useEffect(() => {
    if (!animate || !boxStarted) return;
    const t = setTimeout(() => setTimersDone((v) => Math.max(v, k + 1)), minCheckMs);
    return () => clearTimeout(t);
  }, [animate, boxStarted, k, minCheckMs]);

  const needGap = animate && done && k >= 1 && k < n && gapsDone < k;
  useEffect(() => {
    if (!needGap) return;
    const t = setTimeout(() => setGapsDone((v) => Math.max(v, k)), gapMs);
    return () => clearTimeout(t);
  }, [needGap, k, gapMs]);

  const allRevealed = run.status === "error" || (done && timersDone >= n);
  const wantsCelebration = done && Boolean(run.result?.celebrate);
  const animatedCelebration = wantsCelebration && animate;

  useEffect(() => {
    if (!allRevealed || revealedSent.current) return;
    const fire = () => {
      if (revealedSent.current) return;
      revealedSent.current = true;
      onRevealedRef.current();
    };
    if (animatedCelebration) {
      const t = setTimeout(() => {
        setCelebrating(true);
        fire();
      }, preCelebrationMs);
      return () => clearTimeout(t);
    }
    const t = setTimeout(fire, animate ? 250 : 0);
    return () => clearTimeout(t);
  }, [allRevealed, animatedCelebration, animate, preCelebrationMs]);

  useEffect(() => {
    if (!celebrating) return;
    const t1 = setTimeout(() => setPopupLeaving(true), popupMs);
    const t2 = setTimeout(() => setPopupGone(true), popupMs + 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [celebrating, popupMs]);

  const qualification = run.result?.qualification;
  const boxes = checks.map((kind, i) => {
    const verdict = kind === "date" ? qualification?.date : qualification?.location;
    const copy = checkCopy(kind, def, answers, verdict);
    const isRevealed = done && timersDone > i;
    const isChecking = !isRevealed && (i === 0 ? true : done && timersDone >= i && gapsDone >= i) && run.status !== "error";
    const state: BoxState = isRevealed ? "done" : isChecking ? "checking" : "pending";
    const tone = verdict ? (kind === "date" ? dateTone((verdict as DateVerdict).result) : locationTone((verdict as LocationVerdict).result)) : "unknown";
    const message = verdict?.message?.trim() || FALLBACK_MESSAGE[tone];
    const configured = kind === "date" ? q?.dateLoadingMessages : q?.locationLoadingMessages;
    const fallback = kind === "date" ? DATE_LOADING_MESSAGES : LOCATION_LOADING_MESSAGES;
    const loading = (Array.isArray(configured) && configured.length ? configured : fallback).filter(
      (m) => typeof m === "string" && m.trim(),
    );
    return {
      kind,
      ...copy,
      state,
      tone,
      message,
      loading: loading.length ? loading : [kind === "date" ? "Checking our calendar..." : "Checking the distance..."],
    };
  });

  const checkingBox = boxes.find((b) => b.state === "checking");
  const location = qualification?.location;
  const referralLinks = usableReferralLinks(settings.referral ?? null);
  const showReferral =
    allRevealed && done && location?.result === "fail" && settings.onLocationFail?.action === "referral" && referralLinks.length > 0;
  const locationFailNote =
    allRevealed && done && location?.result === "fail" ? settings.onLocationFail?.message?.trim() || "" : "";
  const urgency = allRevealed && done ? run.result?.urgency?.trim() || "" : "";
  const popupTitle = q?.popupTitle?.trim() || "Good news";
  const popupSubtitle = q?.popupSubtitle?.trim() || "";
  const popupVisible = animatedCelebration && celebrating && !popupGone;
  const staticCelebration = wantsCelebration && !animatedCelebration && allRevealed;

  const announcement =
    run.status === "error"
      ? ""
      : !allRevealed
        ? checkingBox
          ? `Checking ${checkingBox.label.toLowerCase()}`
          : "Checking availability"
        : [
            ...boxes.map((b) => `${b.label}: ${b.message}`),
            wantsCelebration ? `${popupTitle} ${popupSubtitle}`.trim() : "",
            urgency,
          ]
            .filter(Boolean)
            .join(". ");

  return (
    <div className="iqf-qualify">
      {run.status === "error" ? (
        <div className="iqf-notice" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="iqf-notice-body">
            <span>{run.error || "We couldn't check availability just now."}</span>
            <span>Try the check again, or continue and we&apos;ll confirm availability with you.</span>
            <button type="button" className="iqf-linkbtn" onClick={onRetry}>
              Check again
            </button>
          </div>
        </div>
      ) : (
        <>
        {/* Its own space above the checks (house rule: never text over text): the verdicts stay readable. */}
        {popupVisible ? (
          <div className="iqf-popup" data-leaving={popupLeaving ? "true" : "false"} aria-hidden="true">
            <div className="iqf-popup-card">
              <p className="iqf-popup-title">{popupTitle}</p>
              {popupSubtitle ? <p className="iqf-popup-subtitle">{popupSubtitle}</p> : null}
            </div>
          </div>
        ) : null}
        <div className="iqf-checks">
          {boxes.map((b) => (
            <CheckBox
              key={b.kind}
              kind={b.kind}
              label={b.label}
              value={b.value}
              state={b.state}
              tone={b.state === "done" ? b.tone : null}
              message={b.message}
              loading={b.loading}
              intervalMs={intervalMs}
              rotate={animate}
            />
          ))}
          {n === 0 && !ready ? (
            <p className="iqf-check-status" role="status">
              Checking availability...
            </p>
          ) : null}
        </div>
        </>
      )}

      {staticCelebration ? (
        <div className="iqf-celebrate">
          <p className="iqf-celebrate-title">{popupTitle}</p>
          {popupSubtitle ? <p className="iqf-celebrate-subtitle">{popupSubtitle}</p> : null}
        </div>
      ) : null}

      {urgency ? (
        <div className="iqf-note" data-tone="accent">
          <Clock size={18} aria-hidden="true" />
          <span>{urgency}</span>
        </div>
      ) : null}

      {locationFailNote ? (
        <div className="iqf-note" data-tone="info">
          <Info size={18} aria-hidden="true" />
          <span className="iqf-pre">{locationFailNote}</span>
        </div>
      ) : null}

      {showReferral && settings.referral ? <ReferralPanel referral={settings.referral} /> : null}

      <Confetti active={celebrating} colors={confettiColors} reducedMotion={reducedMotion} />

      <p className="iqf-sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
