"use client";

/**
 * Inquiry Forms public renderer - the whole visitor journey for /inquire/<slug>.
 *
 * Contract (spec + types.ts): step 0 Next -> POST start (first step's answers, attribution, honeypot,
 * elapsedMs since first render); later steps -> save; a qualify step -> qualify (server verdicts, cached
 * per step by the date + location answers); last step -> complete (completed or waitlisted). The browser
 * never sends a stage, score or verdict. Same-tab resume via sessionStorage, heartbeat every 45 s while
 * visible plus a beacon on pagehide / hidden, one view beacon per tab session. Preview mode (staff dry
 * run of the draft) calls nothing that writes: qualify goes to the admin preview endpoint.
 *
 * State lives in one reducer (dispatch is used from effects and async handlers; no setState in effect
 * bodies). Every step change focuses the step heading, announces "Step N of M" in a live region and either
 * scrolls the page to the form (standalone) or posts `step` to the host page (embedded).
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, type CSSProperties } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle } from "lucide-react";
import type { Answers, AnswerValue, Attribution, FieldDef, PublicFormBundle } from "@/lib/inquiry-forms/types";
import { stripHidden } from "@/lib/inquiry-forms/answers";
import { HONEYPOT_INPUT_NAME, allFields, findRoleField, stepIndexOfField } from "@/lib/inquiry-forms/definition";
import { formatLongDate, isValidDateString } from "@/lib/inquiry-forms/dates";
import { parseAttribution, safeRedirectUrl } from "@/lib/inquiry-forms/embed-protocol";
import {
  completeSubmission,
  isSessionGone,
  pingSubmission,
  previewQualify,
  qualifySubmission,
  saveStep,
  sendView,
  startSubmission,
  type ApiFailure,
} from "./api";
import { BrandFooter, BrandHeader, EmbedFooter, FormIntro, PreviewRibbon } from "./BrandChrome";
import { Ending, type RedirectState } from "./Ending";
import { fieldDomId } from "./field-shell";
import {
  canContinuePastBlockedDate,
  fieldErrorFor,
  hypeFor,
  isDateBlocked,
  nextLabel,
  previewEnding,
  progressItems,
  qualifyKey,
  stepErrors,
  stepForFieldErrors,
  stepPayload,
  unavailableActions,
  unavailableDialogMessage,
  type Ending as EndingCopy,
  type QualifyResult,
} from "./flow";
import { Progress } from "./Progress";
import { QualifyReveal, type QualifyRun } from "./QualifyReveal";
import {
  clearSession,
  readSession,
  safeSessionStorage,
  viewKey,
  writeSession,
  type QualifyCacheEntry,
  type StoredSession,
} from "./session";
import { StepFields } from "./StepFields";
import { buildFormTheme } from "./theme";
import { UnavailableDialog } from "./UnavailableDialog";
import { useEmbedBridge } from "./useEmbedBridge";
import { useReducedMotion } from "./useReducedMotion";
import { useTurnstile } from "./useTurnstile";

const HEARTBEAT_MS = 45_000;
const SESSION_GONE_MESSAGE =
  "This form session has ended, so your last step was not saved. Start again: your answers are still filled in.";
const CHECK_UNAVAILABLE = "We couldn't check availability just now.";
const TURNSTILE_NEEDED_MESSAGE =
  "Please finish the quick security check below the form, then press the button again. If you do not see it, reload the page (your answers stay).";

/** Field types whose answer is committed by one action, so they are validated on change. */
const COMMIT_ON_CHANGE = new Set<FieldDef["type"]>(["select", "radio", "checkbox", "contact_preference", "budget", "date"]);

type Submission = { id: string; token: string };
type Busy = "saving" | "sending" | "checking";
interface Notice {
  message: string;
  restart: boolean;
}

interface State {
  restored: boolean;
  restoreCount: number;
  stepIndex: number;
  answers: Answers;
  submission: Submission | null;
  errors: Record<string, string>;
  notice: Notice | null;
  busy: Busy | null;
  qualifyCache: Record<string, QualifyCacheEntry>;
  run: QualifyRun | null;
  dialogOpen: boolean;
  waitlist: boolean;
  ending: EndingCopy | null;
  redirect: RedirectState;
  /** Increments on every step change (focus / announce / scroll effect). */
  nav: number;
  /** Increments when the visitor reaches the ending in this page view. */
  endingNav: number;
}

type Action =
  | { type: "restore"; stored: StoredSession | null; run: QualifyRun | null }
  | { type: "answer"; key: string; value: AnswerValue; error?: { key: string; message: string | null } }
  | { type: "setAnswers"; answers: Answers }
  | { type: "fieldError"; key: string; message: string | null }
  | { type: "errors"; errors: Record<string, string> }
  | { type: "notice"; notice: Notice | null }
  | { type: "busy"; busy: Busy | null }
  | { type: "submission"; submission: Submission }
  | { type: "goto"; index: number; run: QualifyRun | null; errors?: Record<string, string> }
  | { type: "rerun"; run: QualifyRun }
  | { type: "runDone"; id: number; result: QualifyResult }
  | { type: "runError"; id: number; error: string }
  | { type: "revealed"; id: number; openDialog: boolean }
  | { type: "dialog"; open: boolean }
  | { type: "waitlist"; on: boolean }
  | { type: "sessionGone" }
  | { type: "restart" }
  | { type: "ended"; ending: EndingCopy; redirect: RedirectState }
  | { type: "redirect"; redirect: RedirectState };

const INITIAL_STATE: State = {
  restored: false,
  restoreCount: 0,
  stepIndex: 0,
  answers: {},
  submission: null,
  errors: {},
  notice: null,
  busy: null,
  qualifyCache: {},
  run: null,
  dialogOpen: false,
  waitlist: false,
  ending: null,
  redirect: { phase: "none" },
  nav: 0,
  endingNav: 0,
};

function withoutKey(errors: Record<string, string>, key: string): Record<string, string> {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "restore": {
      const s = action.stored;
      if (!s) return { ...state, restored: true };
      return {
        ...state,
        restored: true,
        restoreCount: state.restoreCount + 1,
        stepIndex: s.stepIndex,
        answers: s.answers,
        submission: s.submission,
        waitlist: s.waitlist,
        qualifyCache: s.qualify,
        ending: s.ending,
        run: action.run,
      };
    }
    case "answer": {
      const answers = { ...state.answers, [action.key]: action.value };
      let errors = state.errors;
      if (action.error) {
        errors = action.error.message
          ? { ...withoutKey(errors, action.error.key), [action.error.key]: action.error.message }
          : withoutKey(errors, action.error.key);
      }
      return { ...state, answers, errors };
    }
    case "setAnswers":
      return { ...state, answers: action.answers };
    case "fieldError": {
      const errors = action.message
        ? { ...state.errors, [action.key]: action.message }
        : withoutKey(state.errors, action.key);
      return { ...state, errors };
    }
    case "errors":
      return { ...state, errors: action.errors, busy: null, notice: null };
    case "notice":
      return { ...state, notice: action.notice, busy: null };
    case "busy":
      return { ...state, busy: action.busy, notice: action.busy ? null : state.notice };
    case "submission":
      return { ...state, submission: action.submission };
    case "goto":
      return {
        ...state,
        stepIndex: action.index,
        run: action.run,
        errors: action.errors ?? {},
        notice: null,
        busy: null,
        dialogOpen: false,
        nav: state.nav + 1,
      };
    case "rerun":
      return { ...state, run: action.run, notice: null, busy: null, dialogOpen: false };
    case "runDone": {
      const run = state.run;
      if (!run || run.id !== action.id) return state;
      const blocked = isDateBlocked(action.result.qualification.date?.result);
      return {
        ...state,
        busy: null,
        run: { ...run, status: "done", result: action.result, error: null },
        qualifyCache: { ...state.qualifyCache, [run.stepId]: { key: run.key, result: action.result } },
        waitlist: blocked ? state.waitlist : false,
      };
    }
    case "runError": {
      const run = state.run;
      if (!run || run.id !== action.id) return state;
      return { ...state, busy: null, run: { ...run, status: "error", error: action.error, revealed: true } };
    }
    case "revealed": {
      const run = state.run;
      if (!run || run.id !== action.id) return state;
      return { ...state, run: { ...run, revealed: true }, dialogOpen: action.openDialog || state.dialogOpen };
    }
    case "dialog":
      return { ...state, dialogOpen: action.open };
    case "waitlist":
      return { ...state, waitlist: action.on };
    case "sessionGone":
      return {
        ...state,
        submission: null,
        qualifyCache: {},
        busy: null,
        dialogOpen: false,
        notice: { message: SESSION_GONE_MESSAGE, restart: true },
      };
    case "restart":
      return {
        ...state,
        stepIndex: 0,
        submission: null,
        qualifyCache: {},
        run: null,
        waitlist: false,
        ending: null,
        redirect: { phase: "none" },
        errors: {},
        notice: null,
        busy: null,
        dialogOpen: false,
        nav: state.nav + 1,
      };
    case "ended":
      return {
        ...state,
        ending: action.ending,
        redirect: action.redirect,
        busy: null,
        errors: {},
        notice: null,
        dialogOpen: false,
        endingNav: state.endingNav + 1,
      };
    case "redirect":
      return { ...state, redirect: action.redirect };
    default:
      return state;
  }
}

/** Attribution for start: own URL standalone; host values forwarded by embed.js win inside the iframe. */
function collectAttribution(embed: boolean): Attribution {
  const loc = window.location;
  const base = parseAttribution(loc.search, loc.hash, document.referrer, loc.href);
  if (!embed) return base;
  const out: Attribution = { ...base };
  const params = new URLSearchParams(loc.search);
  for (const key of ["page_url", "host_domain", "referrer", "landing_url"] as const) {
    const v = params.get(key);
    if (v) out[key] = v.slice(0, 500);
  }
  return out;
}

function busyLabel(busy: Busy): string {
  if (busy === "sending") return "Sending...";
  if (busy === "checking") return "Checking...";
  return "Saving...";
}

export function FormRenderer({
  bundle,
  embed,
  today,
}: {
  bundle: PublicFormBundle;
  embed: boolean;
  /** Business "today" (America/New_York), computed on the server so both renders agree. */
  today: string;
}) {
  const { definition: def, settings, brand, slug } = bundle;
  const preview = bundle.preview;
  const steps = def.steps;
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const reducedMotion = useReducedMotion();

  const contentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const endingHeadingRef = useRef<HTMLHeadingElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);
  const mountedAtRef = useRef(0);
  const attributionRef = useRef<Attribution | null>(null);
  const runSeq = useRef(0);
  const pendingFocusRef = useRef<string | null>(null);
  const pendingErrorFocusRef = useRef<string | null>(null);
  const viewSentRef = useRef(false);

  const bridge = useEmbedBridge({ enabled: embed, slug, contentRef });
  const {
    attach: attachTurnstile,
    getToken: getTurnstileToken,
    enabled: turnstileEnabled,
  } = useTurnstile(preview ? null : bundle.turnstileSiteKey);

  const theme = useMemo(() => buildFormTheme(settings.accentColor || brand.accentColor), [settings.accentColor, brand.accentColor]);
  const fieldByKey = useMemo(() => {
    const m = new Map<string, FieldDef>();
    for (const f of allFields(def)) m.set(f.key, f);
    return m;
  }, [def]);
  const items = useMemo(() => progressItems(def), [def]);
  // What the server sees: hidden answers dropped across every step (a kept answer of a field that
  // became hidden on an earlier step must not decide visibility here when the server ignores it).
  const visibleAnswers = useMemo(() => stripHidden(def, state.answers), [def, state.answers]);
  const serverView = useCallback((answers: Answers) => stripHidden(def, answers), [def]);

  // Section: side-effect helpers (DOM only)

  const announce = useCallback((text: string) => {
    const el = liveRef.current;
    if (!el) return;
    el.textContent = "";
    window.setTimeout(() => {
      if (liveRef.current) liveRef.current.textContent = text;
    }, 60);
  }, []);

  const focusField = useCallback(
    (key: string): boolean => {
      const root = contentRef.current;
      if (!root) return false;
      const byId = document.getElementById(fieldDomId(key));
      const el =
        byId && root.contains(byId)
          ? byId
          : root.querySelector<HTMLElement>(
              `[data-field-key="${key}"] input, [data-field-key="${key}"] select, [data-field-key="${key}"] textarea`,
            );
      if (!el) return false;
      el.focus({ preventScroll: embed });
      return true;
    },
    [embed],
  );

  const revealForm = useCallback(() => {
    if (embed) {
      bridge.post({ type: "step", index: state.stepIndex, total: steps.length });
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const top = card.getBoundingClientRect().top;
    if (top >= 0 && top < window.innerHeight * 0.5) return;
    const y = Math.max(0, top + window.scrollY - 96);
    window.scrollTo({ top: y, behavior: reducedMotion ? "auto" : "smooth" });
  }, [embed, bridge, state.stepIndex, steps.length, reducedMotion]);

  // Section: qualify runner

  const runQualify = useCallback(
    async (id: number, answers: Answers, sub: Submission | null) => {
      const res = preview
        ? await previewQualify({ formId: bundle.formId, formSlug: slug, answers })
        : sub
          ? await qualifySubmission(sub.id, sub.token)
          : null;
      if (!res) {
        dispatch({ type: "runError", id, error: CHECK_UNAVAILABLE });
        return;
      }
      if (res.ok) {
        dispatch({
          type: "runDone",
          id,
          result: {
            qualification: res.qualification ?? {},
            celebrate: res.celebrate === true,
            urgency: typeof res.urgency === "string" ? res.urgency : null,
          },
        });
        return;
      }
      if (!preview && isSessionGone(res)) {
        clearSession(safeSessionStorage(), slug);
        dispatch({ type: "runError", id, error: SESSION_GONE_MESSAGE });
        dispatch({ type: "sessionGone" });
        return;
      }
      dispatch({ type: "runError", id, error: res.error });
    },
    [preview, bundle.formId, slug],
  );

  // Section: mount: attribution + resume

  useEffect(() => {
    mountedAtRef.current = Date.now();
    attributionRef.current = collectAttribution(embed);
    if (preview) {
      dispatch({ type: "restore", stored: null, run: null });
      return;
    }
    const stored = readSession(
      safeSessionStorage(),
      slug,
      { formId: bundle.formId, versionId: bundle.versionId, stepCount: steps.length },
      Date.now(),
    );
    if (!stored) {
      dispatch({ type: "restore", stored: null, run: null });
      return;
    }
    // Fill time counts from the first visit: a reload that restores filled answers is not a bot.
    if (typeof stored.openedAt === "number" && stored.openedAt < mountedAtRef.current) mountedAtRef.current = stored.openedAt;
    let run: QualifyRun | null = null;
    const target = steps[stored.stepIndex];
    if (target?.kind === "qualify") {
      const key = qualifyKey(def, stored.answers);
      const cached = stored.qualify[target.id];
      runSeq.current += 1;
      run =
        cached && cached.key === key
          ? { id: runSeq.current, stepId: target.id, key, status: "done", result: cached.result, error: null, animate: false, revealed: true }
          : { id: runSeq.current, stepId: target.id, key, status: "pending", result: null, error: null, animate: true, revealed: false };
    }
    dispatch({ type: "restore", stored, run });
    if (run && run.status === "pending") void runQualify(run.id, stored.answers, stored.submission);
  }, [embed, preview, slug, bundle.formId, bundle.versionId, steps, def, runQualify]);

  // Section: persistence, view, heartbeat

  useEffect(() => {
    if (preview || !state.restored) return;
    writeSession(safeSessionStorage(), slug, {
      v: 1,
      formId: bundle.formId,
      versionId: bundle.versionId,
      submission: state.submission,
      stepIndex: state.stepIndex,
      answers: state.answers,
      waitlist: state.waitlist,
      qualify: state.qualifyCache,
      ending: state.ending,
      savedAt: Date.now(),
      openedAt: mountedAtRef.current || Date.now(),
    });
  }, [
    preview,
    slug,
    bundle.formId,
    bundle.versionId,
    state.restored,
    state.submission,
    state.stepIndex,
    state.answers,
    state.waitlist,
    state.qualifyCache,
    state.ending,
  ]);

  const restoredEnding = state.restored && state.ending !== null && state.endingNav === 0;
  useEffect(() => {
    if (preview || !state.restored || viewSentRef.current) return;
    viewSentRef.current = true;
    if (restoredEnding) return;
    const storage = safeSessionStorage();
    try {
      if (storage?.getItem(viewKey(slug))) return;
      storage?.setItem(viewKey(slug), "1");
    } catch {
      // storage refused: count the view anyway (once per page view)
    }
    sendView(slug, bundle.formId);
  }, [preview, state.restored, restoredEnding, slug, bundle.formId]);

  const subId = state.submission?.id ?? null;
  const subToken = state.submission?.token ?? null;
  const ended = state.ending !== null;
  useEffect(() => {
    if (preview || !subId || !subToken || ended) return;
    const beat = (beacon: boolean) => pingSubmission(subId, subToken, beacon);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") beat(false);
    }, HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") beat(true);
    };
    const onPageHide = () => beat(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [preview, subId, subToken, ended]);

  // Section: focus, announce, scroll

  // Each step change (nav) and each arrival at the ending (endingNav) is handled exactly once.
  const handledNav = useRef(0);
  const currentTitle = steps[state.stepIndex]?.title ?? "";
  useEffect(() => {
    if (state.nav === 0 || handledNav.current === state.nav) return;
    handledNav.current = state.nav;
    const key = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (!key || !focusField(key)) headingRef.current?.focus({ preventScroll: true });
    announce(`Step ${state.stepIndex + 1} of ${steps.length}: ${currentTitle}`);
    revealForm();
  }, [state.nav, state.stepIndex, steps.length, currentTitle, focusField, announce, revealForm]);

  const handledEnding = useRef(0);
  const endingTitle = state.ending?.title ?? "";
  useEffect(() => {
    if (state.endingNav === 0 || handledEnding.current === state.endingNav) return;
    handledEnding.current = state.endingNav;
    endingHeadingRef.current?.focus({ preventScroll: true });
    announce(endingTitle);
    revealForm();
  }, [state.endingNav, endingTitle, announce, revealForm]);

  useEffect(() => {
    const key = pendingErrorFocusRef.current;
    if (!key) return;
    pendingErrorFocusRef.current = null;
    focusField(key);
    if (embed) bridge.post({ type: "step", index: state.stepIndex, total: steps.length });
  });

  // Section: flow

  const step = steps[state.stepIndex];
  const isLastIndex = (i: number) => i >= steps.length - 1;

  const showFieldErrors = (errors: Record<string, string>, message?: string) => {
    const keys = Object.keys(errors);
    if (keys.length === 0) return;
    const ordered = allFields(def)
      .map((f) => f.key)
      .find((k) => keys.includes(k) || keys.includes(`${k}__other`) || keys.includes(`${k}__end`));
    pendingErrorFocusRef.current = ordered ?? keys[0];
    dispatch({ type: "errors", errors });
    const count = keys.length;
    announce(message ?? (count === 1 ? "One answer needs your attention." : `${count} answers need your attention.`));
  };

  const handleSessionGone = () => {
    clearSession(safeSessionStorage(), slug);
    dispatch({ type: "sessionGone" });
  };

  const handleFailure = (res: ApiFailure, hadToken: boolean) => {
    if (hadToken && isSessionGone(res)) {
      handleSessionGone();
      return;
    }
    if (res.fieldErrors) {
      const target = stepForFieldErrors(def, res.fieldErrors, res.stepIndex);
      if (target !== null && target !== state.stepIndex && steps[target]?.kind === "fields") {
        const first = Object.keys(res.fieldErrors)[0] ?? null;
        pendingFocusRef.current = first ? first.replace(/__(other|end)$/, "") : null;
        dispatch({ type: "goto", index: target, run: null, errors: res.fieldErrors });
        return;
      }
      showFieldErrors(res.fieldErrors, res.error);
      return;
    }
    dispatch({ type: "notice", notice: { message: res.error, restart: false } });
  };

  const enterStep = (index: number, answers: Answers, sub: Submission | null, cache: Record<string, QualifyCacheEntry>) => {
    const target = steps[index];
    if (!target) return;
    if (target.kind !== "qualify") {
      dispatch({ type: "goto", index, run: null });
      return;
    }
    const key = qualifyKey(def, answers);
    const cached = cache[target.id];
    runSeq.current += 1;
    const id = runSeq.current;
    if (cached && cached.key === key) {
      dispatch({
        type: "goto",
        index,
        run: { id, stepId: target.id, key, status: "done", result: cached.result, error: null, animate: false, revealed: true },
      });
      return;
    }
    dispatch({
      type: "goto",
      index,
      run: { id, stepId: target.id, key, status: "pending", result: null, error: null, animate: true, revealed: false },
    });
    void runQualify(id, answers, sub);
  };

  /** With Turnstile on, a request without a token is never sent (the server would refuse it). */
  const tokenOrAsk = async (): Promise<{ ok: true; token: string | null } | { ok: false }> => {
    const token = await getTurnstileToken();
    if (turnstileEnabled && !token) {
      dispatch({ type: "notice", notice: { message: TURNSTILE_NEEDED_MESSAGE, restart: false } });
      announce(TURNSTILE_NEEDED_MESSAGE);
      return { ok: false };
    }
    return { ok: true, token };
  };

  const doStart = async (payload: Answers): Promise<Submission | null> => {
    const check = await tokenOrAsk();
    if (!check.ok) return null;
    const turnstileToken = check.token;
    const res = await startSubmission({
      formSlug: slug,
      answers: payload,
      attribution: attributionRef.current ?? collectAttribution(embed),
      hp: hpRef.current?.value ?? "",
      elapsedMs: Math.max(0, Date.now() - (mountedAtRef.current || Date.now())),
      turnstileToken,
    });
    if (!res.ok) {
      handleFailure(res, false);
      return null;
    }
    const sub = { id: res.submissionId, token: res.token };
    dispatch({ type: "submission", submission: sub });
    return sub;
  };

  const complete = async (payload: Answers, waitlist: boolean, subIn: Submission | null) => {
    const kind = waitlist ? "waitlisted" : "completed";
    if (preview) {
      const ending = previewEnding(settings, kind);
      const url = safeRedirectUrl(ending.redirectUrl);
      dispatch({
        type: "ended",
        ending,
        redirect: url ? { phase: "manual", url, target: embed ? "_top" : "_self" } : { phase: "none" },
      });
      return;
    }
    dispatch({ type: "busy", busy: "sending" });
    let sub = subIn;
    if (!sub) {
      sub = await doStart(payload);
      if (!sub) return;
    }
    const check = await tokenOrAsk();
    if (!check.ok) return;
    const turnstileToken = check.token;
    const res = await completeSubmission(sub.id, { token: sub.token, answers: payload, ending: kind, turnstileToken });
    if (!res.ok) {
      handleFailure(res, true);
      return;
    }
    const ending = res.ending;
    const url = safeRedirectUrl(ending.redirectUrl);
    dispatch({
      type: "ended",
      ending,
      redirect: url ? (embed ? { phase: "waiting", url } : { phase: "navigating", url }) : { phase: "none" },
    });
    if (embed && settings.hostEvent) bridge.post({ type: "submitted", ending: ending.kind, formName: bundle.name });
    if (!url) return;
    if (!embed) {
      window.location.assign(url);
      return;
    }
    const acked = await bridge.requestRedirect(url);
    dispatch({ type: "redirect", redirect: acked ? { phase: "navigating", url } : { phase: "manual", url, target: "_top" } });
  };

  const advanceFromQualify = async (waitlist: boolean) => {
    const run = state.run;
    if (!run || !run.revealed || state.busy) return;
    const verdict = run.result?.qualification.date;
    if (run.status === "done" && isDateBlocked(verdict?.result) && !waitlist) {
      const actions = unavailableActions(def, settings, verdict);
      if (!canContinuePastBlockedDate(actions)) {
        dispatch({ type: "dialog", open: true });
        return;
      }
    }
    if (isLastIndex(state.stepIndex)) {
      await complete({}, waitlist, state.submission);
      return;
    }
    enterStep(state.stepIndex + 1, state.answers, state.submission, state.qualifyCache);
  };

  const goNext = async () => {
    if (state.busy || state.ending || !step) return;
    if (step.kind === "qualify") {
      await advanceFromQualify(state.waitlist);
      return;
    }
    const errs = stepErrors(step, visibleAnswers, today);
    if (Object.keys(errs).length > 0) {
      showFieldErrors(errs);
      return;
    }
    const idx = state.stepIndex;
    const answers = state.answers;
    const payload = stepPayload(step, serverView(answers));
    if (isLastIndex(idx)) {
      await complete(payload, state.waitlist, state.submission);
      return;
    }
    if (preview) {
      enterStep(idx + 1, answers, null, state.qualifyCache);
      return;
    }
    dispatch({ type: "busy", busy: "saving" });
    let sub = state.submission;
    if (!sub) {
      sub = await doStart(payload);
      if (!sub) return;
    } else {
      const res = await saveStep(sub.id, { token: sub.token, stepIndex: idx, answers: payload });
      if (!res.ok) {
        handleFailure(res, true);
        return;
      }
    }
    enterStep(idx + 1, answers, sub, state.qualifyCache);
  };

  const goBack = () => {
    if (state.busy || state.stepIndex === 0) return;
    enterStep(state.stepIndex - 1, state.answers, state.submission, state.qualifyCache);
  };

  const handleChange = (key: string, value: AnswerValue) => {
    const baseKey = key.replace(/__(other|end)$/, "");
    const field = fieldByKey.get(baseKey);
    let error: { key: string; message: string | null } | undefined;
    if (field && (state.errors[field.key] !== undefined || (key === baseKey && COMMIT_ON_CHANGE.has(field.type)))) {
      error = { key: field.key, message: fieldErrorFor(field, serverView({ ...state.answers, [key]: value }), today) };
    }
    dispatch({ type: "answer", key, value, error });
  };

  const handleBlur = (key: string) => {
    const field = fieldByKey.get(key);
    if (!field) return;
    const v = state.answers[key];
    const empty =
      v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
    if (empty && state.errors[key] === undefined) return;
    const message = fieldErrorFor(field, visibleAnswers, today);
    if ((state.errors[key] ?? null) !== message) dispatch({ type: "fieldError", key, message });
  };

  // Section: qualify step + dialog handlers

  const dateField = findRoleField(def, "event_date");
  const run = state.run && step?.kind === "qualify" && state.run.stepId === step.id ? state.run : null;
  const dateVerdict = run?.status === "done" ? run.result?.qualification.date : undefined;
  const dialogActions = state.dialogOpen && dateVerdict ? unavailableActions(def, settings, dateVerdict) : [];

  const onRevealed = () => {
    const r = state.run;
    if (!r) return;
    const verdict = r.status === "done" ? r.result?.qualification.date : undefined;
    const blocked = isDateBlocked(verdict?.result) && !state.waitlist;
    const actions = blocked ? unavailableActions(def, settings, verdict) : [];
    dispatch({ type: "revealed", id: r.id, openDialog: blocked && actions.length > 0 && r.animate });
  };

  const onRetry = () => {
    const r = state.run;
    if (!r || state.busy) return;
    runSeq.current += 1;
    const id = runSeq.current;
    dispatch({ type: "rerun", run: { ...r, id, status: "pending", result: null, error: null, animate: true, revealed: false } });
    void runQualify(id, state.answers, state.submission);
  };

  const closeDialog = () => {
    dispatch({ type: "dialog", open: false });
    window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 0);
  };

  const onChangeDate = () => {
    if (!dateField) return;
    const idx = stepIndexOfField(def, dateField.key);
    if (idx < 0) return;
    pendingFocusRef.current = dateField.key;
    enterStep(idx, state.answers, state.submission, state.qualifyCache);
  };

  const onPickAlternative = async (date: string) => {
    if (!dateField || state.busy) return;
    const idx = stepIndexOfField(def, dateField.key);
    const nextAnswers = { ...state.answers, [dateField.key]: date };
    dispatch({ type: "setAnswers", answers: nextAnswers });
    dispatch({ type: "dialog", open: false });
    const sub = state.submission;
    if (!preview && sub && idx >= 0 && steps[idx]) {
      dispatch({ type: "busy", busy: "checking" });
      const res = await saveStep(sub.id, { token: sub.token, stepIndex: idx, answers: stepPayload(steps[idx], serverView(nextAnswers)) });
      if (!res.ok) {
        handleFailure(res, true);
        return;
      }
    }
    enterStep(state.stepIndex, nextAnswers, sub, state.qualifyCache);
  };

  const onWaitlist = () => {
    dispatch({ type: "waitlist", on: true });
    dispatch({ type: "dialog", open: false });
    void advanceFromQualify(true);
  };

  const onContinue = () => {
    dispatch({ type: "dialog", open: false });
    void advanceFromQualify(false);
  };

  const restart = () => {
    clearSession(safeSessionStorage(), slug);
    dispatch({ type: "restart" });
  };

  // Section: render

  const label = nextLabel(def, settings, state.stepIndex, state.waitlist);
  const navVisible = step?.kind !== "qualify" || Boolean(run?.revealed);
  const busy = state.busy;
  const confettiColors = [theme["--iqf-accent"], "#22c55e", "#fbbf24", "#10b981", "#f59e0b"];
  const waitlistDate =
    state.waitlist && dateField && typeof state.answers[dateField.key] === "string" && isValidDateString(state.answers[dateField.key] as string)
      ? formatLongDate(state.answers[dateField.key] as string)
      : null;
  const dialogDate =
    dateVerdict?.checkedFor ?? (dateField && typeof state.answers[dateField.key] === "string" ? (state.answers[dateField.key] as string) : null);

  return (
    <div
      ref={contentRef}
      className={embed ? "iqf-root iqf-embed" : "iqf-root iqf-standalone"}
      style={theme as unknown as CSSProperties}
    >
      {!embed ? (
        <a className="iqf-skip" href="#iqf-form">
          Skip to the form
        </a>
      ) : null}
      {preview ? <PreviewRibbon /> : null}
      {!embed ? <BrandHeader brand={brand} /> : null}
      <main id="iqf-form" className="iqf-main" tabIndex={-1}>
        <div className="iqf-column">
          <FormIntro headline={settings.headline} subheadline={settings.subheadline} fallbackTitle={bundle.name} />
          {!state.ending ? (
            <Progress items={items} current={state.stepIndex} complete={false} hype={hypeFor(settings, state.stepIndex)} />
          ) : null}
          <div ref={cardRef} className="iqf-card" inert={state.dialogOpen || undefined}>
            {state.ending ? (
              <Ending ending={state.ending} redirect={state.redirect} headingRef={endingHeadingRef} previewNote={preview} />
            ) : step ? (
              <form
                key={`${step.id}:${state.restoreCount}`}
                className={state.nav > 0 ? "iqf-step iqf-step-enter" : "iqf-step"}
                noValidate
                aria-labelledby="iqf-step-title"
                onSubmit={(e) => {
                  e.preventDefault();
                  void goNext();
                }}
              >
                <h2 id="iqf-step-title" ref={headingRef} tabIndex={-1} className="iqf-step-title">
                  {step.title}
                </h2>
                {step.description?.trim() ? <p className="iqf-step-desc">{step.description}</p> : null}
                {waitlistDate && step.kind === "fields" ? (
                  <div className="iqf-note" data-tone="accent">
                    <CalendarClock size={18} aria-hidden="true" />
                    <span>You&apos;re joining the waitlist for {waitlistDate}.</span>
                  </div>
                ) : null}
                <div className="iqf-step-body" inert={busy !== null || undefined}>
                  {step.kind === "fields" ? (
                    <StepFields
                      step={step}
                      answers={state.answers}
                      visibilityAnswers={visibleAnswers}
                      errors={state.errors}
                      today={today}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  ) : run && !state.notice?.restart ? (
                    <QualifyReveal
                      key={run.id}
                      step={step}
                      def={def}
                      answers={state.answers}
                      settings={settings}
                      run={run}
                      reducedMotion={reducedMotion}
                      confettiColors={confettiColors}
                      onRevealed={onRevealed}
                      onRetry={onRetry}
                    />
                  ) : null}
                </div>
                {state.stepIndex === 0 && !preview ? (
                  <div className="iqf-hp" aria-hidden="true">
                    <label htmlFor="iqf-hp-field">Leave this field empty</label>
                    <input
                      ref={hpRef}
                      id="iqf-hp-field"
                      type="text"
                      name={HONEYPOT_INPUT_NAME}
                      tabIndex={-1}
                      aria-hidden="true"
                      autoComplete="off"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      defaultValue=""
                    />
                  </div>
                ) : null}
                {state.notice ? (
                  <div className="iqf-notice" role="alert">
                    <CircleAlert size={18} aria-hidden="true" />
                    <div className="iqf-notice-body">
                      <span>{state.notice.message}</span>
                      {state.notice.restart ? (
                        <button type="button" className="iqf-linkbtn" onClick={restart}>
                          Start again
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {navVisible && !(state.notice?.restart ?? false) ? (
                  <div className="iqf-nav">
                    {state.stepIndex > 0 ? (
                      <button
                        type="button"
                        className="iqf-btn iqf-btn-secondary"
                        aria-disabled={busy ? true : undefined}
                        onClick={goBack}
                      >
                        <ChevronLeft size={18} aria-hidden="true" />
                        <span>Back</span>
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="iqf-btn iqf-btn-primary"
                      aria-disabled={busy ? true : undefined}
                      aria-busy={busy ? true : undefined}
                    >
                      {busy ? (
                        <>
                          <LoaderCircle size={18} className="iqf-spin" aria-hidden="true" />
                          <span>{busyLabel(busy)}</span>
                        </>
                      ) : (
                        <>
                          <span>{label}</span>
                          {isLastIndex(state.stepIndex) ? null : <ChevronRight size={18} aria-hidden="true" />}
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
              </form>
            ) : (
              <p className="iqf-muted-text">This form has no steps yet.</p>
            )}
            {turnstileEnabled ? <div ref={attachTurnstile} className="iqf-turnstile" /> : null}
          </div>
          {embed ? <EmbedFooter brand={brand} /> : null}
        </div>
      </main>
      {!embed ? <BrandFooter brand={brand} /> : null}
      <div ref={liveRef} className="iqf-sr-only" aria-live="polite" aria-atomic="true" />
      {state.dialogOpen && dateVerdict && dialogActions.length > 0 ? (
        <UnavailableDialog
          date={dialogDate}
          result={dateVerdict.result}
          message={unavailableDialogMessage(dateVerdict.result, settings.onDateUnavailable?.message, dateVerdict.message)}
          actions={dialogActions}
          alternatives={dateVerdict.alternatives ?? []}
          lockScroll={!embed}
          onChangeDate={onChangeDate}
          onPickAlternative={(d) => void onPickAlternative(d)}
          onWaitlist={onWaitlist}
          onContinue={onContinue}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}
