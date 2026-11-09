"use client";

/**
 * Inquiry Forms public renderer - shared field chrome: DOM ids, the label / help / error wrapper and the
 * props every field input receives. Labels are always bound (htmlFor or fieldset legend), errors are
 * visible text tied to the control with aria-describedby (never toast-only).
 */
import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import type { Answers, AnswerValue, FieldDef } from "@/lib/inquiry-forms/types";

export interface FieldInputProps {
  field: FieldDef;
  answers: Answers;
  /** Error for field.key (or one of its companions), null when valid. */
  error: string | null;
  /** Business "today" (America/New_York) as YYYY-MM-DD. */
  today: string;
  onChange: (key: string, value: AnswerValue) => void;
  onBlur: (key: string) => void;
}

export function fieldDomId(key: string): string {
  return `iqf-f-${key}`;
}

export function helpDomId(key: string): string {
  return `iqf-f-${key}-help`;
}

export function errorDomId(key: string): string {
  return `iqf-f-${key}-error`;
}

/** aria-describedby value for a field: help text and/or error, or undefined. */
export function describedBy(field: FieldDef, error: string | null): string | undefined {
  const ids: string[] = [];
  if (field.help?.trim()) ids.push(helpDomId(field.key));
  if (error) ids.push(errorDomId(field.key));
  return ids.length ? ids.join(" ") : undefined;
}

export function stringValue(v: AnswerValue | undefined): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export function FieldError({ fieldKey, message }: { fieldKey: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={errorDomId(fieldKey)} className="iqf-error">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function OptionalTag({ required }: { required: boolean }) {
  if (required) return null;
  return <span className="iqf-optional">Optional</span>;
}

export function FieldHelp({ field }: { field: FieldDef }) {
  const help = field.help?.trim();
  if (!help) return null;
  return (
    <p id={helpDomId(field.key)} className="iqf-help">
      {help}
    </p>
  );
}

/** Wrapper for a field with ONE labelable control (input, select, textarea). */
export function FieldShell({
  field,
  error,
  children,
}: {
  field: FieldDef;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div className="iqf-field" data-width={field.width} data-field-key={field.key}>
      <label className="iqf-label" htmlFor={fieldDomId(field.key)}>
        {field.label}
        {field.required ? null : " "}
        <OptionalTag required={field.required} />
      </label>
      <FieldHelp field={field} />
      {children}
      <FieldError fieldKey={field.key} message={error} />
    </div>
  );
}

/** Wrapper for a field made of several controls (radio/checkbox groups, start + end time). */
export function GroupShell({
  field,
  error,
  role,
  children,
}: {
  field: FieldDef;
  error: string | null;
  /** "radiogroup" lets aria-invalid / aria-required sit on the group itself. */
  role?: "radiogroup";
  children: ReactNode;
}) {
  const isRadioGroup = role === "radiogroup";
  return (
    <fieldset
      className="iqf-field"
      data-width={field.width}
      data-field-key={field.key}
      role={role}
      aria-describedby={describedBy(field, error)}
      aria-invalid={isRadioGroup && error ? true : undefined}
      aria-required={isRadioGroup && field.required ? true : undefined}
    >
      <legend className="iqf-label">
        {field.label}
        {field.required ? null : " "}
        <OptionalTag required={field.required} />
      </legend>
      <FieldHelp field={field} />
      {children}
      <FieldError fieldKey={field.key} message={error} />
    </fieldset>
  );
}
