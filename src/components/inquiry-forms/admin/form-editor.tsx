"use client";

/**
 * Inquiry Forms - the form editor shell: tabs Build | Settings | Share | Submissions.
 *
 * The draft {name, slug, definition, settings} lives in client state with an in-memory undo
 * history (50 deep). Nothing a visitor sees changes until Publish: Save draft writes the draft
 * row (with an optimistic-concurrency token), Publish snapshots the SAVED draft into a new
 * version. Unsaved work is guarded on reload, tab close and in-app link clicks.
 */
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Eye,
  Hammer,
  Inbox,
  Loader2,
  Pause,
  Play,
  Redo2,
  Save,
  Send,
  Settings,
  Share2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { getFormForEdit, publishForm, saveDraft, setFormStatus } from "@/app/(app)/inquiry-forms/actions";
import { formatEasternTimestamp } from "@/lib/inquiry-forms/dates";
import { allFields, validateDefinition } from "@/lib/inquiry-forms/definition";
import { prepareDraftDefinition, savedWithIssuesLabel } from "@/lib/inquiry-forms/draft";
import type { BrandProfile, BusinessSettings, FieldDef, FormDefinition, FormSettings } from "@/lib/inquiry-forms/types";
import { validateFormSettings } from "./settings-validate";
import { checkFormName, FORM_STATUS_LABEL, FORM_STATUS_TONE } from "./list-helpers";
import { Chip } from "./list-ui";
import SharePanel from "./share-panel";
import SubmissionsPanel from "./submissions-panel";
import {
  checkDefinition,
  checkSettings,
  locateValidationMessage,
  mergeValidationErrors,
  sectionForSettingsPath,
  sortIssues,
  type EditorIssue,
  type IssueTarget,
} from "./builder-checks";
import { useHistory } from "./builder-history";
import { BuilderIssues } from "./builder-issues";
import { coerceDefinition, locateField, stableStringify, type EditorDraft, type FormStatus } from "./builder-ops";
import { BuildTab, type BuilderSelection, type ToastOptions } from "./builder-tab";
import { Callout, ConfirmDialog, OPAQUE_SURFACE_STYLE, btn, shortcut, useIsMac } from "./builder-ui";
import { FormSettingsPanel, settingsSectionId } from "./form-settings-panel";
import { isValidSlug } from "@/lib/inquiry-forms/slug";

// Types and pure helpers

export type EditorTab = "build" | "settings" | "share" | "submissions";

export const EDITOR_TABS: ReadonlyArray<{ id: EditorTab; label: string; icon: LucideIcon }> = [
  { id: "build", label: "Build", icon: Hammer },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "share", label: "Share", icon: Share2 },
  { id: "submissions", label: "Submissions", icon: Inbox },
];

export function parseEditorTab(raw: unknown): EditorTab {
  return raw === "settings" || raw === "share" || raw === "submissions" ? raw : "build";
}

/** The form as getFormForEdit returns it. */
export interface EditorFormData {
  id: string;
  slug: string;
  name: string;
  brand: string;
  status: FormStatus;
  definition: FormDefinition;
  settings: FormSettings;
  updatedAt: string;
  publishedVersion: number | null;
  publishedAt: string | null;
  hasSubmissions: boolean;
  publishedKeys: string[];
  /** What keeps the SAVED draft from being published (drafts are saved with their issues). */
  draftIssues?: string[];
}

export interface FormEditorProps {
  form: EditorFormData;
  brands: BrandProfile[];
  publicOrigin: string;
  /** Business settings (for the availability step notes); null when they could not load. */
  business: BusinessSettings | null;
  initialTab: EditorTab;
}

interface Meta {
  status: FormStatus;
  /** Concurrency token from the last load or save (draft_saved_at; publish and status never move it). */
  updatedAt: string;
  publishedVersion: number | null;
  publishedAt: string | null;
  hasSubmissions: boolean;
  publishedKeys: string[];
  /** Slug saved on the server: the live address. */
  savedSlug: string;
}

interface Problem {
  message: string;
  target: IssueTarget | null;
}

type Banner =
  | { kind: "conflict" }
  | { kind: "problems"; title: string; message?: string; problems: Problem[] }
  | { kind: "saved-issues"; problems: Problem[] }
  | { kind: "error"; title: string; message: string }
  | { kind: "published"; version: number };

interface Toast {
  id: number;
  message: string;
  /** Undo is offered while the history is still at this version. */
  undoVersion: number | null;
  tone: "default" | "error";
}

type Busy = null | "saving" | "publishing" | "status" | "loading";

function draftFromForm(f: EditorFormData): EditorDraft {
  return { name: f.name, slug: f.slug, definition: coerceDefinition(f.definition), settings: f.settings };
}

function metaFromForm(f: EditorFormData): Meta {
  return {
    status: f.status,
    updatedAt: f.updatedAt,
    publishedVersion: f.publishedVersion,
    publishedAt: f.publishedAt,
    hasSubmissions: f.hasSubmissions,
    publishedKeys: f.publishedKeys,
    savedSlug: f.slug,
  };
}

/** Choice values per field at load: past answers may use them, so relabeling keeps them. */
function choiceBaseline(def: FormDefinition): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const f of allFields(def)) {
    if (f.choices?.length) map.set(f.id, new Set(f.choices.map((c) => c.value)));
  }
  return map;
}

function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "the Hub could not be reached";
}

const easternTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

function savedTimeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? `${easternTime.format(t)} ET` : null;
}

/**
 * What stops a draft from being SAVED at all (saveDraft refuses exactly these): the name, the web
 * address, and a draft that cannot be stored (unreadable, or over the size limit). Anything else
 * is saved with its issues listed, so no work is ever lost.
 */
function saveBlockers(draft: EditorDraft, meta: Meta): Problem[] {
  const out: Problem[] = [];
  const basics: IssueTarget = { tab: "settings", section: "basics" };
  const name = checkFormName(draft.name);
  if (!name.ok) out.push({ message: name.error, target: basics });
  const slug = draft.slug.trim().toLowerCase();
  if (!isValidSlug(slug)) {
    out.push({ message: "Web address: use 3 to 60 lowercase letters, numbers and single dashes, like check-your-date.", target: basics });
  } else if (meta.publishedVersion !== null && slug !== meta.savedSlug) {
    out.push({ message: `This form is published, so its address stays /inquire/${meta.savedSlug}.`, target: basics });
  }
  const stored = prepareDraftDefinition(draft.definition);
  if (!stored.ok) out.push({ message: stored.error, target: null });
  return out;
}

/** Messages from the server (or the pure checks) with the place each one points at. */
function problemsFrom(messages: string[], draft: EditorDraft, brands: BrandProfile[]): Problem[] {
  const settings = validateFormSettings(draft.settings, { brandKeys: brands.map((b) => b.key) });
  const settingsPath = new Map(settings.ok ? [] : settings.issues.map((i) => [i.message, i.path] as const));
  return messages.map((message) => {
    const path = settingsPath.get(message);
    return path !== undefined
      ? { message, target: { tab: "settings", section: sectionForSettingsPath(path) } }
      : { message, target: locateValidationMessage(draft.definition, message) };
  });
}

/**
 * Everything publishForm would refuse, checked with the same pure modules, so the editor can
 * point at each problem without a round trip.
 */
function publishBlockers(draft: EditorDraft, brands: BrandProfile[], meta: Meta): Problem[] {
  const def = validateDefinition(draft.definition);
  const settings = validateFormSettings(draft.settings, { brandKeys: brands.map((b) => b.key) });
  const messages = [...(def.ok ? [] : def.errors), ...(settings.ok ? [] : settings.issues.map((i) => i.message))];
  return [...saveBlockers(draft, meta), ...problemsFrom(messages, draft, brands)];
}

function ProblemList({ problems, onGo }: { problems: Problem[]; onGo: (target: IssueTarget | null) => void }) {
  if (problems.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {problems.map((p, i) => (
        <li key={`${i}-${p.message}`}>
          {p.target ? (
            <button
              type="button"
              onClick={() => onGo(p.target)}
              className="rounded text-left underline decoration-current/60 underline-offset-2 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              {p.message}
            </button>
          ) : (
            <span>{p.message}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function isTextEditable(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "submit", "reset", "color", "range", "file", "image"].includes(el.type);
  }
  return false;
}

/** Inputs bound to the draft live inside [data-history-scope]; scratch inputs opt out. */
function inHistoryScope(el: HTMLElement): boolean {
  return Boolean(el.closest("[data-history-scope]")) && !el.closest("[data-history-ignore]");
}

// Status menu

function StatusMenu({
  status,
  published,
  disabled,
  onPublish,
  onPause,
  onResume,
  onArchive,
  onRestore,
}: {
  status: FormStatus;
  published: boolean;
  disabled: boolean;
  onPublish: () => void;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const items: Array<{ label: string; hint: string; icon: LucideIcon; run: () => void; danger?: boolean }> = [];
  if (status === "draft") items.push({ label: "Publish to go live", hint: "Visitors can use it right away.", icon: Send, run: onPublish });
  if (status === "live") items.push({ label: "Pause", hint: "Stop taking new inquiries for now.", icon: Pause, run: onPause });
  if (status === "paused" && published) {
    items.push({ label: "Resume", hint: "Take inquiries again with the published version.", icon: Play, run: onResume });
  }
  if (status !== "archived") {
    items.push({ label: "Archive", hint: "Retire the form. Submissions are kept.", icon: Archive, run: onArchive, danger: true });
  }
  if (status === "archived") {
    items.push({
      label: "Restore",
      hint: published ? "Comes back paused, so nothing goes live by surprise." : "Comes back as a draft.",
      icon: ArchiveRestore,
      run: onRestore,
    });
  }

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={btn.secondary}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || items.length === 0}
        onClick={() => setOpen((v) => !v)}
      >
        Status <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Form status"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-md p-1.5 text-[var(--foreground)] shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                item.run();
              }}
              className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              <item.icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${item.danger ? "text-red-700 dark:text-red-300" : "text-[var(--brand)]"}`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${item.danger ? "text-red-800 dark:text-red-200" : ""}`}>{item.label}</span>
                <span className="block text-xs text-[var(--muted)]">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// The editor

const EMPTY_SET: ReadonlySet<string> = new Set();

export function FormEditor({ form, brands, publicOrigin, business, initialTab }: FormEditorProps) {
  // Built ONCE: coerceDefinition may mint ids for a broken row, and the history, the saved
  // snapshot and the selection must all see the same ones (or the form opens "unsaved").
  const [initialDraft] = useState(() => draftFromForm(form));
  const history = useHistory<EditorDraft>(() => initialDraft);
  const draft = history.present;
  const isMac = useIsMac();

  const [meta, setMeta] = useState<Meta>(() => metaFromForm(form));
  const [saved, setSaved] = useState(() => ({ json: stableStringify(initialDraft) }));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** Issues the SAVED draft has (from the last save or load): "Saved with N issues". */
  const [savedIssues, setSavedIssues] = useState<string[]>(() => form.draftIssues ?? []);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [baseline, setBaseline] = useState(() => choiceBaseline(initialDraft.definition));
  const [tab, setTab] = useState<EditorTab>(initialTab);
  const [selection, setSelection] = useState<BuilderSelection>(() => ({
    stepId: initialDraft.definition.steps[0]?.id ?? null,
    fieldId: null,
  }));
  const [busy, setBusy] = useState<Busy>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<null | "archive" | "load-latest" | "keep-mine">(null);

  const inFlight = useRef(false);
  const toastSeq = useRef(0);
  const versionRef = useRef(history.version);
  useEffect(() => {
    versionRef.current = history.version;
  }, [history.version]);

  // derived

  const draftJson = useMemo(() => stableStringify(draft), [draft]);
  const dirty = draftJson !== saved.json;
  const lockedKeys = useMemo<ReadonlySet<string>>(
    () => (meta.hasSubmissions ? new Set(meta.publishedKeys) : EMPTY_SET),
    [meta.hasSubmissions, meta.publishedKeys],
  );
  const publishedKeySet = useMemo<ReadonlySet<string>>(() => new Set(meta.publishedKeys), [meta.publishedKeys]);

  const issues = useMemo(() => {
    const ctx = { business, brands, savedSlug: meta.savedSlug, slugLocked: meta.publishedVersion !== null };
    const local = [...checkDefinition(draft.definition, ctx), ...checkSettings(draft, ctx)];
    const v = validateDefinition(draft.definition);
    return sortIssues(mergeValidationErrors(local, v.ok ? [] : v.errors, draft.definition));
  }, [draft, business, brands, meta.savedSlug, meta.publishedVersion]);

  const buildErrors = issues.filter((i) => i.severity === "error" && i.target?.tab !== "settings").length;
  const settingsErrors = issues.filter((i) => i.severity === "error" && i.target?.tab === "settings").length;

  /** Selection that always points at something that exists (undo can remove things). */
  const resolved = useMemo<BuilderSelection>(() => {
    const steps = draft.definition.steps;
    if (selection.fieldId) {
      const loc = locateField(draft.definition, selection.fieldId);
      if (loc) return { stepId: loc.step.id, fieldId: loc.field.id };
    }
    const step = steps.find((s) => s.id === selection.stepId) ?? steps[0] ?? null;
    return { stepId: step?.id ?? null, fieldId: null };
  }, [draft.definition, selection]);

  // toasts

  const toast = useCallback((message: string, opts?: ToastOptions) => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    const undoVersion = opts?.undoable ? versionRef.current + 1 : null;
    setToasts((list) => [...list.slice(-2), { id, message, undoVersion, tone: opts?.tone ?? "default" }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 7000);
  }, []);
  const dismissToast = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

  // edits

  const edit = history.set;
  const editDefinition = useCallback(
    (updater: (def: FormDefinition) => FormDefinition, key?: string) =>
      edit((d) => {
        const next = updater(d.definition);
        return next === d.definition ? d : { ...d, definition: next };
      }, key),
    [edit],
  );

  // tabs

  const selectTab = useCallback((next: EditorTab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "build") params.delete("tab");
    else params.set("tab", next);
    if (next !== "submissions") params.delete("s");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  // The selected tab is always in view in the tab row (a bell link opens ?tab=submissions at 390 px).
  useEffect(() => {
    document.getElementById(`form-editor-tab-${tab}`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [tab]);

  const onTabKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = EDITOR_TABS.findIndex((t) => t.id === tab);
    const nextIndex =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? EDITOR_TABS.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : EDITOR_TABS.length - 1)) % EDITOR_TABS.length;
    const next = EDITOR_TABS[nextIndex].id;
    selectTab(next);
    requestAnimationFrame(() => document.getElementById(`form-editor-tab-${next}`)?.focus());
  };

  const goTo = useCallback(
    (target: IssueTarget | null) => {
      if (!target) return;
      if (target.tab === "settings") {
        flushSync(() => selectTab("settings"));
        document.getElementById(settingsSectionId(target.section))?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      flushSync(() => {
        selectTab("build");
        setSelection({ stepId: target.stepId, fieldId: target.fieldId });
      });
      const el = target.fieldId
        ? document.querySelector(`[data-field-card="${target.fieldId}"]`)
        : target.stepId
          ? document.querySelector(`[data-step-row="${target.stepId}"]`)
          : null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [selectTab],
  );

  // server calls

  const refreshMeta = async () => {
    try {
      const res = await getFormForEdit(form.id);
      if (!res.ok) return;
      const f = res.form;
      // Never take updatedAt here: it is the concurrency token for OUR next save.
      setMeta((m) => ({
        ...m,
        status: f.status,
        publishedVersion: f.publishedVersion,
        publishedAt: f.publishedAt,
        hasSubmissions: f.hasSubmissions,
        publishedKeys: f.publishedKeys,
      }));
    } catch {
      // Keep the values we already show; the next load corrects them.
    }
  };

  const save = async (opts: { expectedUpdatedAt?: string } = {}): Promise<boolean> => {
    if (inFlight.current) return false;
    const payload = draft;
    // Only what the server cannot store blocks a save; every other problem is saved with the draft.
    const problems = saveBlockers(payload, meta);
    if (problems.length > 0) {
      setBanner({
        kind: "problems",
        title: problems.length === 1 ? "Fix this before saving" : `Fix these ${problems.length} things before saving`,
        message: "Nothing was saved yet. Your changes are still here.",
        problems,
      });
      return false;
    }
    inFlight.current = true;
    setBusy("saving");
    const slug = payload.slug.trim().toLowerCase();
    try {
      const res = await saveDraft({
        id: form.id,
        name: payload.name,
        slug,
        definition: payload.definition,
        settings: payload.settings,
        expectedUpdatedAt: opts.expectedUpdatedAt ?? meta.updatedAt,
      });
      if (res.ok) {
        const issues = Array.isArray(res.issues) ? res.issues : [];
        setMeta((m) => ({ ...m, updatedAt: res.updatedAt, savedSlug: slug }));
        setSaved({ json: stableStringify(payload) });
        setSavedAt(res.updatedAt);
        setSavedIssues(issues);
        if (meta.publishedVersion !== null) setPendingPublish(true);
        if (issues.length > 0) {
          setBanner({ kind: "saved-issues", problems: problemsFrom(issues, payload, brands) });
        } else {
          setBanner((b) => (b && b.kind !== "published" ? null : b));
        }
        return true;
      }
      if (res.conflict) {
        setBanner({ kind: "conflict" });
        return false;
      }
      setBanner({
        kind: "problems",
        title: "The draft was not saved",
        message: res.error,
        problems: problemsFrom(res.errors ?? [], payload, brands),
      });
      return false;
    } catch (e) {
      setBanner({
        kind: "error",
        title: "The draft was not saved",
        message: `Your changes are still here. Please try again (${errorText(e)}).`,
      });
      return false;
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const publish = async () => {
    if (inFlight.current) return;
    const problems = publishBlockers(draft, brands, meta);
    if (problems.length > 0) {
      setBanner({
        kind: "problems",
        title: problems.length === 1 ? "Fix this before publishing" : `Fix these ${problems.length} things before publishing`,
        problems,
      });
      return;
    }
    if (dirty || banner?.kind === "conflict") {
      const ok = await save();
      if (!ok) return;
    }
    inFlight.current = true;
    setBusy("publishing");
    try {
      const res = await publishForm(form.id);
      if (!res.ok) {
        setBanner({
          kind: "problems",
          title: "The form was not published",
          message: res.error,
          problems: problemsFrom(res.errors ?? [], draft, brands),
        });
        return;
      }
      setPendingPublish(false);
      setSavedIssues([]);
      setMeta((m) => ({
        ...m,
        publishedVersion: res.version,
        publishedAt: new Date().toISOString(),
        status: m.status === "draft" ? "live" : m.status,
      }));
      setBanner({ kind: "published", version: res.version });
      await refreshMeta();
    } catch (e) {
      setBanner({ kind: "error", title: "The form was not published", message: `Please try again (${errorText(e)}).` });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const changeStatus = async (next: "live" | "paused" | "archived", done: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("status");
    try {
      const res = await setFormStatus(form.id, next);
      if (!res.ok) {
        setBanner({ kind: "error", title: "The status did not change", message: res.error ?? "Please try again." });
        return;
      }
      setMeta((m) => ({ ...m, status: next === "paused" && m.publishedVersion === null ? "draft" : next }));
      toast(done);
      await refreshMeta();
    } catch (e) {
      setBanner({ kind: "error", title: "The status did not change", message: `Please try again (${errorText(e)}).` });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const loadLatest = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("loading");
    try {
      const res = await getFormForEdit(form.id);
      if (!res.ok) {
        setBanner({ kind: "error", title: "Could not load the latest version", message: res.error });
        return;
      }
      const next = draftFromForm(res.form);
      history.reset(next);
      setSaved({ json: stableStringify(next) });
      setMeta(metaFromForm(res.form));
      setBaseline(choiceBaseline(next.definition));
      setSavedIssues(res.form.draftIssues ?? []);
      setPendingPublish(false);
      setBanner(null);
      toast("Loaded the latest saved version.");
    } catch (e) {
      setBanner({ kind: "error", title: "Could not load the latest version", message: `Please try again (${errorText(e)}).` });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const keepMine = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("loading");
    let token: string | null = null;
    try {
      const res = await getFormForEdit(form.id);
      if (!res.ok) {
        setBanner({ kind: "error", title: "Could not check the latest version", message: res.error });
        return;
      }
      token = res.form.updatedAt;
      const f = res.form;
      setMeta((m) => ({
        ...m,
        status: f.status,
        publishedVersion: f.publishedVersion,
        publishedAt: f.publishedAt,
        hasSubmissions: f.hasSubmissions,
        publishedKeys: f.publishedKeys,
        savedSlug: f.slug,
      }));
    } catch (e) {
      setBanner({ kind: "error", title: "Could not check the latest version", message: `Please try again (${errorText(e)}).` });
      return;
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
    if (token) {
      const ok = await save({ expectedUpdatedAt: token });
      if (ok) toast("Saved your version over the other one.");
    }
  };

  const openPreview = async () => {
    const url = (slug: string) => `/inquire/${encodeURIComponent(slug)}?preview=draft`;
    if (!dirty && banner?.kind !== "conflict") {
      window.open(url(meta.savedSlug), "_blank", "noopener");
      return;
    }
    // Open the tab inside the click (popup blockers), then point it at the preview once saved.
    const win = window.open("", "_blank");
    if (win) {
      try {
        win.opener = null;
        win.document.title = "Saving the draft...";
        win.document.body.style.cssText = "font: 16px system-ui, sans-serif; color: #111827; background: #ffffff; padding: 32px;";
        win.document.body.textContent = "Saving your draft, then opening the preview...";
      } catch {
        // Some browsers keep the blank tab locked; it still navigates below.
      }
    }
    const ok = await save();
    if (!ok) {
      win?.close();
      return;
    }
    const target = new URL(url(draft.slug.trim().toLowerCase()), window.location.origin).toString();
    if (win) win.location.replace(target);
    else window.open(target, "_blank", "noopener");
  };

  // keyboard, unload and link guards

  const onWindowKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    const key = e.key.toLowerCase();
    if (key === "s") {
      e.preventDefault();
      if (!busy && (dirty || banner?.kind === "conflict")) void save();
      return;
    }
    if (key !== "z" && key !== "y") return;
    if (tab !== "build" && tab !== "settings") return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target && isTextEditable(target) && !inHistoryScope(target)) return;
    e.preventDefault();
    if (key === "y" || e.shiftKey) history.redo();
    else history.undo();
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onWindowKeyDown(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("This form has unsaved changes. Leave without saving them?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // render

  const published = meta.publishedVersion !== null;
  const liveUrl = `${publicOrigin.replace(/\/+$/, "")}/inquire/${meta.savedSlug}`;
  const savedLabel = savedTimeLabel(savedAt);
  const savedWithIssues = !dirty && busy === null && savedIssues.length > 0;
  const saveState =
    busy === "saving"
      ? "Saving..."
      : busy === "publishing"
        ? "Publishing..."
        : dirty
          ? "Unsaved changes"
          : savedWithIssues
            ? savedWithIssuesLabel(savedIssues.length)
            : savedLabel
              ? `Saved ${savedLabel}`
              : "All changes saved";
  const protectedChoiceValues = (field: FieldDef): ReadonlySet<string> => baseline.get(field.id) ?? EMPTY_SET;
  const undoLabel = `Undo (${shortcut(isMac, "Z")})`;
  const redoLabel = `Redo (${shortcut(isMac, "Z", true)})`;
  const saveLabel = `Save draft (${shortcut(isMac, "S")})`;

  return (
    <div className="mx-auto max-w-[96rem] pb-6 text-[var(--foreground)] [color-scheme:light] dark:[color-scheme:dark]">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3">
        <Link
          href="/inquiry-forms"
          className="inline-flex w-fit items-center gap-1 rounded text-sm text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All inquiry forms
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Inquiry form</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{draft.name.trim() || "Untitled form"}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
              <Chip tone={FORM_STATUS_TONE[meta.status]}>{FORM_STATUS_LABEL[meta.status]}</Chip>
              <span>
                {published
                  ? `Live version ${meta.publishedVersion}${meta.publishedAt ? `, published ${formatEasternTimestamp(meta.publishedAt)}` : ""}`
                  : "Not published yet"}
              </span>
              <span
                className={`inline-flex items-center gap-1 ${dirty || savedWithIssues ? "font-medium text-amber-800 dark:text-amber-200" : ""}`}
                role="status"
                aria-live="polite"
                title={savedWithIssues && savedLabel ? `Saved ${savedLabel}. Fix the issues before you publish.` : undefined}
              >
                {busy === "saving" || busy === "publishing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {saveState}
              </span>
              {pendingPublish && !dirty ? (
                <span className="font-medium text-[var(--foreground)]">Saved as a draft: publish to update the live form.</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-l-lg text-[var(--foreground)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={history.undo}
                disabled={!history.canUndo}
                aria-label={undoLabel}
                title={undoLabel}
              >
                <Undo2 className="h-4 w-4" aria-hidden />
              </button>
              <span className="h-5 w-px bg-[var(--border)]" aria-hidden />
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-r-lg text-[var(--foreground)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={history.redo}
                disabled={!history.canRedo}
                aria-label={redoLabel}
                title={redoLabel}
              >
                <Redo2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => void openPreview()}
              disabled={busy !== null}
              title="Save the draft and open it in a new tab (nothing a visitor sees changes)"
            >
              <Eye className="h-4 w-4" aria-hidden /> Preview
            </button>
            <button type="button" className={btn.secondary} onClick={() => void save()} disabled={busy !== null || !dirty} title={saveLabel}>
              {busy === "saving" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              Save draft
            </button>
            <button
              type="button"
              className={btn.primary}
              onClick={() => void publish()}
              disabled={busy !== null || meta.status === "archived"}
              title={meta.status === "archived" ? "Restore the form before publishing" : "Make the saved draft the live version"}
            >
              {busy === "publishing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Publish
            </button>
            <StatusMenu
              status={meta.status}
              published={published}
              disabled={busy !== null}
              onPublish={() => void publish()}
              onPause={() => void changeStatus("paused", "Paused. The form is not taking new inquiries.")}
              onResume={() => void changeStatus("live", "Live again. The form is taking inquiries.")}
              onArchive={() => setConfirm("archive")}
              onRestore={() =>
                void changeStatus("paused", published ? "Restored as paused. Resume it when you are ready." : "Restored as a draft.")
              }
            />
          </div>
        </div>
      </div>

      {/* Banners */}
      <div className="mb-4 space-y-3">
        {banner?.kind === "conflict" ? (
          <Callout
            tone="error"
            title="Someone else saved this form after you opened it"
            actions={
              <>
                <button type="button" className={btn.secondary} onClick={() => setConfirm("load-latest")} disabled={busy !== null}>
                  Load the latest version
                </button>
                <button type="button" className={btn.secondary} onClick={() => setConfirm("keep-mine")} disabled={busy !== null}>
                  Keep my version and save it
                </button>
              </>
            }
          >
            Maybe in another tab, or another admin. Your edits are still here and have not been saved. Load the latest version
            to see theirs (your unsaved edits are dropped), or save yours over it.
          </Callout>
        ) : null}
        {banner?.kind === "problems" ? (
          <Callout
            tone="error"
            title={banner.title}
            actions={
              <button type="button" className={btn.ghostTint} onClick={() => setBanner(null)}>
                Dismiss
              </button>
            }
          >
            {banner.message ? <p>{banner.message}</p> : null}
            <ProblemList problems={banner.problems} onGo={goTo} />
          </Callout>
        ) : null}
        {banner?.kind === "saved-issues" ? (
          <Callout
            tone="warning"
            title={savedWithIssuesLabel(banner.problems.length)}
            actions={
              <button type="button" className={btn.ghostTint} onClick={() => setBanner(null)}>
                Dismiss
              </button>
            }
          >
            <p>
              Your draft is saved, so nothing is lost. Fix these before you publish: visitors keep seeing the live version
              until then.
            </p>
            <ProblemList problems={banner.problems} onGo={goTo} />
          </Callout>
        ) : null}
        {banner?.kind === "error" ? (
          <Callout
            tone="error"
            title={banner.title}
            actions={
              <button type="button" className={btn.ghostTint} onClick={() => setBanner(null)}>
                Dismiss
              </button>
            }
          >
            {banner.message}
          </Callout>
        ) : null}
        {banner?.kind === "published" ? (
          <Callout
            tone="success"
            title={`Published version ${banner.version}`}
            actions={
              <>
                <a href={liveUrl} target="_blank" rel="noreferrer" className={btn.secondary}>
                  <ExternalLink className="h-4 w-4" aria-hidden /> Open the live form
                </a>
                <button type="button" className={btn.ghostTint} onClick={() => selectTab("share")}>
                  <Share2 className="h-4 w-4" aria-hidden /> Share or embed it
                </button>
                <button type="button" className={btn.ghostTint} onClick={() => setBanner(null)}>
                  Dismiss
                </button>
              </>
            }
          >
            {meta.status === "paused"
              ? "The form is paused, so visitors see this version once you resume it."
              : "Visitors see this version now. Embeds pick it up on their next page load."}
          </Callout>
        ) : null}
        {tab === "build" || tab === "settings" ? <BuilderIssues issues={issues} onGo={(i: EditorIssue) => goTo(i.target)} /> : null}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Form editor"
        onKeyDown={onTabKeyDown}
        className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]"
      >
        {EDITOR_TABS.map((t) => {
          const active = t.id === tab;
          const errors = t.id === "build" ? buildErrors : t.id === "settings" ? settingsErrors : 0;
          return (
            <button
              key={t.id}
              id={`form-editor-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`form-editor-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-sm font-medium sm:px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] ${
                active
                  ? "border-[var(--brand)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {/* Icons from sm up: at 390 px the four labels fit without a hidden sideways scroll. */}
              <t.icon className="hidden h-4 w-4 sm:block" aria-hidden />
              {t.label}
              {errors > 0 ? (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                  {errors}
                  <span className="sr-only">{errors === 1 ? " problem" : " problems"}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`form-editor-panel-${tab}`} aria-labelledby={`form-editor-tab-${tab}`} className="min-w-0">
        {tab === "build" ? (
          <BuildTab
            definition={draft.definition}
            submitLabel={draft.settings.submitLabel.trim() || "Send"}
            editDefinition={editDefinition}
            breakCoalesce={history.breakCoalesce}
            selection={resolved}
            onSelect={setSelection}
            issues={issues}
            lockedKeys={lockedKeys}
            publishedKeys={publishedKeySet}
            protectedChoiceValues={protectedChoiceValues}
            business={business}
            toast={toast}
          />
        ) : null}
        {tab === "settings" ? (
          <div className="@container">
            <FormSettingsPanel
              draft={draft}
              edit={edit}
              breakCoalesce={history.breakCoalesce}
              brands={brands}
              publicOrigin={publicOrigin}
              savedSlug={meta.savedSlug}
              slugLocked={published}
              issues={issues}
            />
          </div>
        ) : null}
        {tab === "share" ? (
          <div className="space-y-3">
            {dirty || draft.slug.trim().toLowerCase() !== meta.savedSlug ? (
              <Callout tone="info">
                The links below use the saved address. Unsaved changes are not part of the live form until you save and
                publish.
              </Callout>
            ) : null}
            <SharePanel slug={meta.savedSlug} publicOrigin={publicOrigin} status={meta.status} />
          </div>
        ) : null}
        {tab === "submissions" ? <SubmissionsPanel formId={form.id} /> : null}
      </div>

      {/* Bottom bar: unsaved changes + toasts, stacked so nothing overlaps */}
      {dirty || toasts.length > 0 ? (
        <div className="pointer-events-none sticky bottom-4 z-40 mt-6 flex flex-col items-center gap-2 px-2">
          <div className="flex w-full max-w-xl flex-col gap-2" aria-live="polite" role="status">
            {toasts.map((t) => {
              const canUndo = t.undoVersion !== null && t.undoVersion === history.version;
              return (
                <div
                  key={t.id}
                  className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-3 py-2 text-sm shadow-lg ${
                    t.tone === "error"
                      ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950 dark:text-red-100"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                  }`}
                >
                  <span className="min-w-0 flex-1">{t.message}</span>
                  {canUndo ? (
                    <button
                      type="button"
                      className={btn.ghost}
                      onClick={() => {
                        history.undo();
                        dismissToast(t.id);
                      }}
                    >
                      <Undo2 className="h-4 w-4" aria-hidden /> Undo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => dismissToast(t.id)}
                    aria-label="Dismiss"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
          {dirty ? (
            <div
              className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-xl"
              style={OPAQUE_SURFACE_STYLE}
            >
              <span className="px-1 text-sm font-medium text-[var(--foreground)]">Unsaved changes</span>
              <button type="button" className={btn.ghost} onClick={history.undo} disabled={!history.canUndo} title={undoLabel}>
                <Undo2 className="h-4 w-4" aria-hidden /> Undo
              </button>
              <button type="button" className={btn.primary} onClick={() => void save()} disabled={busy !== null} title={saveLabel}>
                {busy === "saving" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Save draft
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === "archive"}
        title="Archive this form?"
        confirmLabel="Archive"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void changeStatus("archived", "Archived. Restore it any time from the Status menu.");
        }}
      >
        <p>Archived forms stop taking inquiries and leave the main list. Submissions and versions are kept.</p>
        {meta.status === "live" ? (
          <p className="font-medium">This form is live now: any website that embeds it stops working until you restore it.</p>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "load-latest"}
        title="Load the latest saved version?"
        confirmLabel="Load it"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void loadLatest();
        }}
      >
        <p>Your unsaved edits here are replaced by the version someone else saved. This cannot be undone.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "keep-mine"}
        title="Save your version over theirs?"
        confirmLabel="Save mine"
        tone="default"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void keepMine();
        }}
      >
        <p>The changes they saved after you opened the form are replaced by yours.</p>
      </ConfirmDialog>
    </div>
  );
}

export default FormEditor;
