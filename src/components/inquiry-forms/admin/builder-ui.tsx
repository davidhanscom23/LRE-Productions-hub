"use client";

/**
 * Inquiry Forms builder - small shared UI atoms (hub tokens, hand-rolled Tailwind).
 * Inputs here are controlled by the draft, so undo / redo updates them too.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ModalPortal } from "./modal-portal";

export const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)] disabled:cursor-not-allowed disabled:bg-[var(--surface-hover)] [color-scheme:light] dark:[color-scheme:dark]";

/**
 * Opaque form of the hub surface for sticky bars over page content. The glass skins set --surface
 * 86-88% opaque, so text under a bar read through it (backdrop-blur did not help). Inline style wins
 * over the bar's bg-[var(--surface)] class; browsers without relative colors drop it and keep the class.
 */
export const OPAQUE_SURFACE_STYLE = { backgroundColor: "rgb(from var(--surface) r g b / 1)" } as const;

/** White text on the light-mode brand, near-black on the (lighter) dark-mode brand: both pass contrast. */
export const onBrandText = "text-white dark:text-gray-950";

export const inputErrorClass = "border-red-500 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900/40";

export const optionClass = "bg-[var(--surface)] text-[var(--foreground)]";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-950",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60",
  /**
   * Ghost button inside a tinted box (Callout): takes the box's own text color, never the hub tokens
   * (the glass skins make --foreground cream without .dark, which vanished on the pastel boxes).
   */
  ghostTint:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-current underline decoration-current/40 underline-offset-2 transition hover:bg-black/5 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-[var(--surface)] px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40",
  dangerSolid:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60",
};

// Platform-aware shortcut labels (no hydration mismatch: server says "Ctrl")

function subscribeNever() {
  return () => {};
}

export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

export function shortcut(isMac: boolean, key: string, shift = false): string {
  if (isMac) return `${shift ? "Shift+" : ""}Cmd+${key}`;
  return `Ctrl+${shift ? "Shift+" : ""}${key}`;
}

// Field shell

interface ShellProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  /** Right side of the label row (e.g. a lock badge or a helper button). */
  aside?: ReactNode;
}

export function FieldShell({ id, label, hint, error, children, aside }: ShellProps) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-[var(--foreground)]">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const ids = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

interface TextFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  type?: "text" | "url" | "email";
  inputRef?: Ref<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: () => void;
  aside?: ReactNode;
  id?: string;
  /** Text before the input (e.g. a URL prefix). */
  prefix?: ReactNode;
  spellCheck?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  multiline,
  rows = 3,
  maxLength,
  disabled,
  type = "text",
  inputRef,
  onBlur,
  aside,
  id: idProp,
  prefix,
  spellCheck,
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const cls = `${inputClass} ${error ? inputErrorClass : ""}`;
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(id, hint, error),
  };
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} aside={aside}>
      {multiline ? (
        <textarea
          id={id}
          ref={inputRef as Ref<HTMLTextAreaElement>}
          className={`${cls} min-h-[4.5rem] resize-y leading-relaxed`}
          rows={rows}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          spellCheck={spellCheck}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          {...aria}
        />
      ) : prefix ? (
        <div
          className={`flex min-w-0 items-stretch overflow-hidden rounded-lg border bg-[var(--surface)] focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand-soft)] ${
            error ? "border-red-500" : "border-[var(--border)]"
          }`}
        >
          <span className="flex max-w-[55%] shrink items-center truncate border-r border-[var(--border)] bg-[var(--surface-hover)] px-2.5 text-xs text-[var(--muted)]">
            {prefix}
          </span>
          <input
            id={id}
            ref={inputRef as Ref<HTMLInputElement>}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            type={type}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            spellCheck={spellCheck}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            {...aria}
          />
        </div>
      ) : (
        <input
          id={id}
          ref={inputRef as Ref<HTMLInputElement>}
          className={cls}
          type={type}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          spellCheck={spellCheck}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          {...aria}
        />
      )}
    </FieldShell>
  );
}

// Number input (keeps partial typing like "2." while the draft holds 2)

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : String(value);
}

export function parseNumberText(text: string, allowDecimal: boolean): number | null | undefined {
  const t = text.replace(/[,\s$]/g, "");
  if (t === "") return null;
  const re = allowDecimal ? /^-?\d+(\.\d*)?$/ : /^-?\d+$/;
  if (!re.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

interface NumberFieldProps {
  label: ReactNode;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  hint?: ReactNode;
  error?: string | null;
  placeholder?: string;
  allowDecimal?: boolean;
  disabled?: boolean;
  /** Small text after the input, e.g. "sec" or "$". */
  unit?: string;
  onBlur?: () => void;
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  allowDecimal = false,
  disabled,
  unit,
  onBlur,
}: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => formatNumber(value));
  const [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    // The draft changed (typing, undo, redo): show it unless the text already means it.
    setSeen(value);
    if (parseNumberText(text, allowDecimal) !== (value ?? null)) setText(formatNumber(value));
  }
  const parsed = parseNumberText(text, allowDecimal);
  const typingError = parsed === undefined ? "Enter a number." : null;
  const shownError = typingError ?? error ?? null;
  return (
    <FieldShell id={id} label={label} hint={hint} error={shownError}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          className={`${inputClass} ${shownError ? inputErrorClass : ""}`}
          inputMode={allowDecimal ? "decimal" : "numeric"}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy(id, hint, shownError)}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            const n = parseNumberText(raw, allowDecimal);
            if (n !== undefined && n !== (value ?? null)) onChange(n);
          }}
          onBlur={() => {
            if (parseNumberText(text, allowDecimal) === undefined) setText(formatNumber(value));
            onBlur?.();
          }}
        />
        {unit ? <span className="shrink-0 text-xs text-[var(--muted)]">{unit}</span> : null}
      </div>
    </FieldShell>
  );
}

// Lines (one item per line) - for message lists and hype labels

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

interface LinesFieldProps {
  label: ReactNode;
  value: readonly string[];
  onChange: (lines: string[]) => void;
  hint?: ReactNode;
  error?: string | null;
  placeholder?: string;
  rows?: number;
  onBlur?: () => void;
}

export function LinesField({ label, value, onChange, hint, error, placeholder, rows = 4, onBlur }: LinesFieldProps) {
  const id = useId();
  const joined = value.join("\n");
  const [text, setText] = useState(joined);
  // Compare by content: callers may pass a fresh [] on every render.
  const [seen, setSeen] = useState(joined);
  if (seen !== joined) {
    setSeen(joined);
    if (splitLines(text).join("\n") !== joined) setText(joined);
  }
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={`${inputClass} min-h-[5rem] resize-y leading-relaxed ${error ? inputErrorClass : ""}`}
        rows={rows}
        value={text}
        placeholder={placeholder}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const lines = splitLines(raw);
          if (lines.join("\n") !== value.join("\n")) onChange(lines);
        }}
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

// Select, toggle, segmented

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  hint?: ReactNode;
  error?: string | null;
  disabled?: boolean;
}

export function SelectField({ label, value, onChange, options, hint, error, disabled }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={`${inputClass} ${error ? inputErrorClass : ""} pr-8`}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} className={optionClass}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface ToggleProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
}

export function ToggleField({ label, checked, onChange, hint, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="mt-0.5 text-xs text-[var(--muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--border)] bg-[var(--surface-hover)]"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/10 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  hint?: ReactNode;
}

export function SegmentedField<T extends string>({ label, value, onChange, options, hint }: SegmentedProps<T>) {
  const id = useId();
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + (e.key === "ArrowRight" ? 1 : enabled.length - 1)) % enabled.length];
    if (next) {
      e.preventDefault();
      onChange(next.value);
      const btnEl = e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`);
      btnEl?.focus();
    }
  };
  return (
    <div className="min-w-0">
      <p id={`${id}-label`} className="mb-1 text-xs font-semibold text-[var(--foreground)]">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onKeyDown={onKeyDown}
        className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-1"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              data-value={o.value}
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={o.disabled}
              onClick={() => onChange(o.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                  : "text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// Callout, section, icon button

const calloutTone = {
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100",
    Icon: Info,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    Icon: AlertTriangle,
  },
  error: {
    box: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100",
    Icon: XCircle,
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
    Icon: CheckCircle2,
  },
} as const;

export function Callout({
  tone,
  title,
  children,
  actions,
  className = "",
}: {
  tone: keyof typeof calloutTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const t = calloutTone[tone];
  return (
    <div className={`flex gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${t.box} ${className}`}>
      <t.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function PanelSection({
  id,
  title,
  description,
  children,
  actions,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  tone = "default",
  className = "",
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "default" | "danger";
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Confirm dialog (closes only via X, Cancel or Escape - never on an outside click)

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (e.key !== "Tab" || !boxRef.current) return;
    const focusables = Array.from(
      boxRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, textarea, select"),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Under <body> (ModalPortal), so the hub's skin art never paints over the dialog.
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="presentation">
      <div
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? bodyId : undefined}
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-md p-5 text-[var(--foreground)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onCancel} disabled={busy}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
        {children ? (
          <div id={bodyId} className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
            {children}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" className={btn.secondary} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? btn.dangerSolid : btn.primary}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}
