"use client";

/**
 * Inquiry Forms settings - list editors: staff alert recipients, referral links and the
 * ordered "date is taken" actions.
 */
import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { safeRedirectUrl } from "@/lib/inquiry-forms/embed-protocol";
import { HUB_COPY } from "@/lib/inquiry-forms/hub-copy";
import type { DateUnavailableAction } from "@/lib/inquiry-forms/types";
import { isEmailAddress } from "./builder-checks";
import { moveItem } from "./builder-ops";
import { IconButton, TextField, btn, inputClass, inputErrorClass } from "./builder-ui";

// Staff email recipients (chips)

export function RecipientsEditor({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const id = useId();
  const [pending, setPending] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addPending = () => {
    const parts = pending
      .split(/[,;\s]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    const bad = parts.filter((p) => !isEmailAddress(p));
    const good = parts.filter((p) => isEmailAddress(p) && !value.includes(p));
    if (good.length) onChange([...value, ...good.filter((g, i) => good.indexOf(g) === i)]);
    if (bad.length) {
      setPending(bad.join(", "));
      setError(bad.length === 1 ? `"${bad[0]}" is not a valid email address.` : "Some addresses are not valid.");
    } else {
      setPending("");
      setError(null);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addPending();
    } else if (e.key === "Backspace" && !pending && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="min-w-0" data-history-ignore>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-[var(--foreground)]">
        Staff email alerts (optional)
      </label>
      {value.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Staff email recipients">
          {value.map((email) => {
            const valid = isEmailAddress(email);
            return (
              <li
                key={email}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs ${
                  valid
                    ? "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--foreground)]"
                    : "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                }`}
              >
                <span className="truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== email))}
                  aria-label={`Remove ${email}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="off"
          className={`${inputClass} ${error ? inputErrorClass : ""}`}
          value={pending}
          placeholder={HUB_COPY.exampleEmail}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          onChange={(e) => {
            setPending(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (pending.trim()) addPending();
          }}
        />
        <button type="button" className={btn.secondary} onClick={addPending} disabled={!pending.trim()}>
          Add
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--muted)]">
        Each address gets an email for every new inquiry. Press Enter after each one. Leave empty to rely on Hub alerts.
      </p>
    </div>
  );
}

// Referral links

export function ReferralLinksEditor({
  links,
  onChange,
  onBlur,
}: {
  links: ReadonlyArray<{ label: string; url: string }>;
  onChange: (next: { label: string; url: string }[], coalesceKey?: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--foreground)]">Referral links</p>
      {links.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No links yet. Add trusted partners visitors outside your area can contact.</p>
      ) : null}
      <ol className="space-y-2">
        {links.map((link, index) => {
          const urlOk = Boolean(safeRedirectUrl(link.url.trim()));
          return (
            <li key={index} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="flex items-end gap-1">
                <div className="min-w-0 flex-1">
                  <TextField
                    label={`Link ${index + 1} name`}
                    value={link.label}
                    onChange={(label) => {
                      const next = links.slice();
                      next[index] = { ...link, label };
                      onChange(next, `referral:${index}:label`);
                    }}
                    onBlur={onBlur}
                    placeholder="Partner name"
                    error={link.label.trim() ? null : "Add a name."}
                  />
                </div>
                <IconButton label="Move link up" onClick={() => onChange(moveItem(links, index, index - 1))} disabled={index === 0}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </IconButton>
                <IconButton
                  label="Move link down"
                  onClick={() => onChange(moveItem(links, index, index + 1))}
                  disabled={index === links.length - 1}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </IconButton>
                <IconButton label="Remove link" tone="danger" onClick={() => onChange(links.filter((_, i) => i !== index))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconButton>
              </div>
              <TextField
                label="Web address"
                type="url"
                value={link.url}
                onChange={(url) => {
                  const next = links.slice();
                  next[index] = { ...link, url };
                  onChange(next, `referral:${index}:url`);
                }}
                onBlur={onBlur}
                placeholder="https://"
                spellCheck={false}
                error={link.url.trim() && !urlOk ? "Use a full address starting with https://" : !link.url.trim() ? "Add the address." : null}
              />
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className={btn.secondary}
        onClick={() => onChange([...links, { label: "", url: "" }])}
        disabled={links.length >= 10}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add link
      </button>
      {links.length >= 10 ? <p className="text-xs text-[var(--muted)]">Up to 10 links.</p> : null}
    </div>
  );
}

// Date is taken: ordered actions

export const DATE_ACTION_COPY: Record<DateUnavailableAction, { label: string; hint: string }> = {
  change_date: { label: "Pick another date", hint: "They choose a new date and the check runs again." },
  alternatives: { label: "Show nearby open dates", hint: "Suggests up to 3 nearby dates that look open." },
  waitlist: { label: "Join the waitlist", hint: "Sends the request as a waitlist inquiry with its own thank-you." },
  continue: { label: "Send the request anyway", hint: "Keeps going; the team checks with them by hand." },
};

const ALL_ACTIONS: DateUnavailableAction[] = ["change_date", "alternatives", "waitlist", "continue"];

export function DateActionsEditor({
  value,
  onChange,
}: {
  value: readonly DateUnavailableAction[];
  onChange: (next: DateUnavailableAction[]) => void;
}) {
  const groupId = useId();
  const unchecked = ALL_ACTIONS.filter((a) => !value.includes(a));
  const rows = [...value, ...unchecked];
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-semibold text-[var(--foreground)]">What visitors can do (in this order)</legend>
      <ol className="space-y-1.5">
        {rows.map((action) => {
          const checked = value.includes(action);
          const pos = value.indexOf(action);
          const inputId = `${groupId}-${action}`;
          return (
            <li
              key={action}
              className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 ${
                checked ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <input
                id={inputId}
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                checked={checked}
                aria-describedby={`${inputId}-hint`}
                onChange={(e) => onChange(e.target.checked ? [...value, action] : value.filter((a) => a !== action))}
              />
              <span className="min-w-0 flex-1">
                <label htmlFor={inputId} className="block cursor-pointer text-sm font-medium text-[var(--foreground)]">
                  {checked ? `${pos + 1}. ` : ""}
                  {DATE_ACTION_COPY[action].label}
                </label>
                <span id={`${inputId}-hint`} className="block text-xs text-[var(--muted)]">
                  {DATE_ACTION_COPY[action].hint}
                </span>
              </span>
              {checked ? (
                <span className="flex shrink-0 items-center">
                  <IconButton label="Show earlier" onClick={() => onChange(moveItem(value, pos, pos - 1))} disabled={pos === 0}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Show later"
                    onClick={() => onChange(moveItem(value, pos, pos + 1))}
                    disabled={pos === value.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </IconButton>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {value.length === 0 ? (
        <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">Pick at least one.</p>
      ) : null}
    </fieldset>
  );
}
