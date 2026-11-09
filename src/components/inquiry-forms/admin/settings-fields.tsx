"use client";

import { useId, type ReactNode } from "react";
import { cls } from "./list-ui";

/**
 * Small labeled controls for the business settings page. Every control has a bound label,
 * help text, and aria-invalid + aria-describedby when it has an error.
 */

function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const list = ids.filter(Boolean) as string[];
  return list.length ? list.join(" ") : undefined;
}

export function FieldShell({
  id,
  label,
  help,
  error,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={cls.label}>
        {label}
      </label>
      {help ? (
        <p id={`${id}-help`} className="mt-0.5 text-xs text-[var(--muted)]">
          {help}
        </p>
      ) : null}
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={`${id}-error`} className={cls.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  help,
  error,
  value,
  onChange,
  placeholder,
  maxLength,
  autoComplete,
  className,
}: {
  label: string;
  help?: ReactNode;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} error={error} className={className}>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete ?? "off"}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(help ? `${id}-help` : null, error ? `${id}-error` : null)}
        className={`${cls.input} ${error ? cls.inputInvalid : ""}`}
      />
    </FieldShell>
  );
}

/** Visitor-facing message box (2-4 lines). */
export function MessageField({
  label,
  help,
  error,
  value,
  onChange,
}: {
  label: string;
  help?: ReactNode;
  error?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <textarea
        id={id}
        rows={2}
        value={value}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(help ? `${id}-help` : null, error ? `${id}-error` : null)}
        className={`${cls.input} min-h-[4.5rem] ${error ? cls.inputInvalid : ""}`}
      />
    </FieldShell>
  );
}

/** Parses what was typed: "" -> null, a number -> that number, anything else -> NaN (shown as an error). */
export function parseNumberInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Number box that keeps exactly what the person typed. Uncontrolled on purpose: remount it with a new
 * `key` when the value changes from outside (for example after "Find on map").
 */
export function NumberField({
  label,
  help,
  error,
  defaultValue,
  onValue,
  suffix,
  placeholder,
  decimal,
  disabled,
  className,
}: {
  label: string;
  help?: ReactNode;
  error?: string;
  defaultValue: number | null | undefined;
  onValue: (n: number | null) => void;
  suffix?: string;
  placeholder?: string;
  decimal?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const initial =
    typeof defaultValue === "number" && Number.isFinite(defaultValue) ? String(defaultValue) : "";
  return (
    <FieldShell id={id} label={label} help={help} error={error} className={className}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          defaultValue={initial}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onValue(parseNumberInput(e.target.value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(help ? `${id}-help` : null, error ? `${id}-error` : null)}
          className={`${cls.input} max-w-[10rem] tabular-nums ${error ? cls.inputInvalid : ""}`}
        />
        {suffix ? <span className="text-sm text-[var(--foreground)]">{suffix}</span> : null}
      </div>
    </FieldShell>
  );
}

export function Toggle({
  label,
  help,
  checked,
  onChange,
  disabled,
  error,
}: {
  label: string;
  help?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={describedBy(help ? `${id}-help` : null, error ? `${id}-error` : null)}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-[var(--border)] accent-[var(--brand)] disabled:cursor-not-allowed"
        />
        <div className="min-w-0">
          <label htmlFor={id} className={`text-sm font-medium text-[var(--foreground)] ${disabled ? "opacity-80" : ""}`}>
            {label}
          </label>
          {help ? (
            <p id={`${id}-help`} className="text-xs text-[var(--muted)]">
              {help}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className={cls.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A radio group with a legend and one description per option. */
export function RadioCards<T extends string>({
  legend,
  help,
  value,
  options,
  onChange,
  error,
}: {
  legend: string;
  help?: ReactNode;
  value: T;
  options: { value: T; label: string; description: string }[];
  onChange: (v: T) => void;
  error?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className={cls.label}>{legend}</legend>
      {help ? <p className="mt-0.5 text-xs text-[var(--muted)]">{help}</p> : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const selected = value === o.value;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                selected
                  ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--foreground)]">{o.label}</span>
                <span className="block text-xs text-[var(--foreground)] opacity-80">{o.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? <p className={cls.fieldError}>{error}</p> : null}
    </fieldset>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = useId();
  return (
    <section id={id} className={`${cls.card} space-y-4`} aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className={cls.sectionTitle}>
          {title}
        </h2>
        {description ? <p className={`${cls.help} mt-0.5`}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
