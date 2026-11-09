/**
 * Inquiry Forms admin: shared class names and tiny presentational pieces (chips, notices).
 * No hooks and no "use client": usable from server and client components.
 * Contrast: body text uses the foreground token, secondary text the muted token (full opacity), and the
 * primary button switches to dark text in dark mode where the brand color is light.
 */
import type { ReactNode } from "react";
import type { Tone } from "./list-helpers";
import { HUB_COPY } from "@/lib/inquiry-forms/hub-copy";

export const cls = {
  card: "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5",
  sectionTitle: "text-base font-semibold text-[var(--foreground)]",
  help: "text-sm text-[var(--muted)]",
  label: "block text-sm font-medium text-[var(--foreground)]",
  input:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:cursor-not-allowed disabled:opacity-70 [color-scheme:light] dark:[color-scheme:dark]",
  inputInvalid: "border-red-600 dark:border-red-400",
  select:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 [color-scheme:light] dark:[color-scheme:dark]",
  btnPrimary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-950",
  btnSecondary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60",
  btnSmall:
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDangerSmall:
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-[var(--surface)] px-2.5 text-xs font-medium text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40",
  iconBtn:
    "inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]",
  fieldError: "mt-1 text-sm font-medium text-red-700 dark:text-red-300",
} as const;

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  bad: "bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  neutral: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
};

export function Chip({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone,
  title,
  children,
}: {
  tone: "warn" | "bad" | "info" | "good";
  title?: string;
  children?: ReactNode;
}) {
  const box: Record<typeof tone, string> = {
    warn: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
    bad: "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
    info: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    good: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${box[tone]}`} role={tone === "bad" ? "alert" : undefined}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
    </div>
  );
}

/** Page eyebrow + title + one-line description, matching the Leads page header. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">{HUB_COPY.sectionEyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
