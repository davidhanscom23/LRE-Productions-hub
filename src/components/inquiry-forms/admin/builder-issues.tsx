"use client";

/**
 * Inquiry Forms builder - the live setup checklist: problems that block publishing first,
 * then suggestions. Each row jumps to the step, field or settings section it is about.
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CornerDownRight, XCircle } from "lucide-react";
import type { EditorIssue } from "./builder-checks";

export function BuilderIssues({
  issues,
  onGo,
}: {
  issues: EditorIssue[];
  onGo: (issue: EditorIssue) => void;
}) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const [open, setOpen] = useState(errors.length > 0);

  if (issues.length === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
        role="status"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Setup check: no problems found.
      </div>
    );
  }

  const summary = [
    errors.length ? `${errors.length} ${errors.length === 1 ? "problem" : "problems"} to fix before publishing` : null,
    warnings.length ? `${warnings.length} ${warnings.length === 1 ? "suggestion" : "suggestions"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      // The box sets its own text color; rows inherit it (hub tokens vanish on the glass skins).
      className={`rounded-xl border ${
        errors.length
          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
          : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
          errors.length ? "text-red-900 dark:text-red-100" : "text-amber-950 dark:text-amber-100"
        }`}
      >
        {errors.length ? (
          <XCircle className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1">Setup check: {summary}</span>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
      </button>
      {open ? (
        <ul className="max-h-64 space-y-0.5 overflow-y-auto px-2 pb-2">
          {[...errors, ...warnings].map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => onGo(issue)}
                disabled={!issue.target}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-current hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-white/10 dark:focus-visible:bg-white/10"
              >
                {issue.severity === "error" ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-label="Problem" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Suggestion" />
                )}
                <span className="min-w-0 flex-1">{issue.message}</span>
                {issue.target ? (
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-current underline decoration-current/50 underline-offset-2">
                    <CornerDownRight className="h-3.5 w-3.5" aria-hidden /> Go there
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
