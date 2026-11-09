"use client";

/**
 * Inquiry Forms public renderer - single-control inputs: text, email, phone, address, textarea, number,
 * date and time (with optional end time). 16px text, 48px controls, bound labels, autocomplete tokens
 * for the visitor's own contact details, autocomplete off for venue text (it is not the visitor's address).
 */
import { useState } from "react";
import type { FieldDef } from "@/lib/inquiry-forms/types";
import {
  FieldShell,
  GroupShell,
  describedBy,
  errorDomId,
  fieldDomId,
  stringValue,
  type FieldInputProps,
} from "./field-shell";

const END = "__end";

function autoCompleteFor(field: FieldDef): string | undefined {
  switch (field.role) {
    case "name":
      return "name";
    case "email":
      return "email";
    case "phone":
      return "tel";
    case "company":
      return "organization";
    case "event_location":
      return "off";
    default:
      break;
  }
  if (field.type === "address") return "off";
  if (field.type === "email") return "email";
  if (field.type === "phone") return "tel";
  return undefined;
}

export function TextInput({ field, answers, error, onChange, onBlur }: FieldInputProps) {
  const type = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
  const isEmail = field.type === "email";
  const maxLength = field.maxLength ?? (isEmail ? 254 : field.type === "phone" ? 30 : 200);
  return (
    <FieldShell field={field} error={error}>
      <input
        id={fieldDomId(field.key)}
        name={field.key}
        type={type}
        className="iqf-input"
        value={stringValue(answers[field.key])}
        placeholder={field.placeholder || undefined}
        maxLength={maxLength}
        autoComplete={autoCompleteFor(field)}
        inputMode={isEmail ? "email" : field.type === "phone" ? "tel" : undefined}
        autoCapitalize={isEmail ? "none" : field.role === "name" ? "words" : undefined}
        spellCheck={isEmail || field.type === "phone" ? false : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={field.required ? true : undefined}
        aria-describedby={describedBy(field, error)}
        onChange={(e) => onChange(field.key, e.target.value)}
        onBlur={() => onBlur(field.key)}
      />
    </FieldShell>
  );
}

export function TextAreaInput({ field, answers, error, onChange, onBlur }: FieldInputProps) {
  const value = stringValue(answers[field.key]);
  const max = field.maxLength ?? 2000;
  const showCounter = value.length >= max * 0.8;
  return (
    <FieldShell field={field} error={error}>
      <textarea
        id={fieldDomId(field.key)}
        name={field.key}
        className="iqf-textarea"
        value={value}
        rows={4}
        placeholder={field.placeholder || undefined}
        maxLength={max}
        aria-invalid={error ? true : undefined}
        aria-required={field.required ? true : undefined}
        aria-describedby={describedBy(field, error)}
        onChange={(e) => onChange(field.key, e.target.value)}
        onBlur={() => onBlur(field.key)}
      />
      {showCounter ? (
        <p className="iqf-counter" aria-live="polite">
          {value.length} of {max} characters
        </p>
      ) : null}
    </FieldShell>
  );
}

/** Keeps the typed text (so "1" -> "15" never fights a controlled number) and stores a number or null. */
export function NumberInput({ field, answers, error, onChange, onBlur }: FieldInputProps) {
  const initial = answers[field.key];
  const [draft, setDraft] = useState(() => (typeof initial === "number" ? String(initial) : ""));
  const allowNegative = typeof field.min === "number" && field.min < 0;
  return (
    <FieldShell field={field} error={error}>
      <input
        id={fieldDomId(field.key)}
        name={field.key}
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        className="iqf-input"
        value={draft}
        placeholder={field.placeholder || undefined}
        maxLength={12}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-required={field.required ? true : undefined}
        aria-describedby={describedBy(field, error)}
        onChange={(e) => {
          const clean = e.target.value.replace(allowNegative ? /[^\d.-]/g : /[^\d.]/g, "");
          setDraft(clean);
          const n = clean === "" ? NaN : Number(clean);
          onChange(field.key, Number.isFinite(n) ? n : null);
        }}
        onBlur={() => onBlur(field.key)}
      />
    </FieldShell>
  );
}

export function DateInput({ field, answers, error, today, onChange, onBlur }: FieldInputProps) {
  return (
    <FieldShell field={field} error={error}>
      <input
        id={fieldDomId(field.key)}
        name={field.key}
        type="date"
        className="iqf-input"
        value={stringValue(answers[field.key])}
        min={today}
        aria-invalid={error ? true : undefined}
        aria-required={field.required ? true : undefined}
        aria-describedby={describedBy(field, error)}
        onChange={(e) => onChange(field.key, e.target.value || null)}
        onBlur={() => onBlur(field.key)}
      />
    </FieldShell>
  );
}

export function TimeInput(props: FieldInputProps) {
  const { field, answers, error, onChange, onBlur } = props;
  if (!field.showEndTime) {
    return (
      <FieldShell field={field} error={error}>
        <input
          id={fieldDomId(field.key)}
          name={field.key}
          type="time"
          className="iqf-input"
          value={stringValue(answers[field.key])}
          aria-invalid={error ? true : undefined}
          aria-required={field.required ? true : undefined}
          aria-describedby={describedBy(field, error)}
          onChange={(e) => onChange(field.key, e.target.value || null)}
          onBlur={() => onBlur(field.key)}
        />
      </FieldShell>
    );
  }
  const endKey = `${field.key}${END}`;
  const inputDescribedBy = error ? errorDomId(field.key) : undefined;
  return (
    <GroupShell field={field} error={error}>
      <div className="iqf-pair">
        <div>
          <label className="iqf-sublabel" htmlFor={fieldDomId(field.key)}>
            Start time
          </label>
          <input
            id={fieldDomId(field.key)}
            name={field.key}
            type="time"
            className="iqf-input"
            value={stringValue(answers[field.key])}
            aria-invalid={error ? true : undefined}
            aria-required={field.required ? true : undefined}
            aria-describedby={inputDescribedBy}
            onChange={(e) => onChange(field.key, e.target.value || null)}
            onBlur={() => onBlur(field.key)}
          />
        </div>
        <div>
          <label className="iqf-sublabel" htmlFor={fieldDomId(endKey)}>
            End time
          </label>
          <input
            id={fieldDomId(endKey)}
            name={endKey}
            type="time"
            className="iqf-input"
            value={stringValue(answers[endKey])}
            aria-invalid={error ? true : undefined}
            aria-describedby={inputDescribedBy}
            onChange={(e) => onChange(endKey, e.target.value || null)}
            onBlur={() => onBlur(field.key)}
          />
        </div>
      </div>
    </GroupShell>
  );
}
