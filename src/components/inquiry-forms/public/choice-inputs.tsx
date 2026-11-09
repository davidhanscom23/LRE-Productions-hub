"use client";

/**
 * Inquiry Forms public renderer - choice inputs: select, radio and checkbox groups (list, cards, chips),
 * the single consent checkbox, and contact preference cards. Native radio / checkbox inputs restyled, so
 * keyboard and screen reader behavior stays native. Selected state = accent border + soft tint + bold
 * label (never color alone), applied with an inset shadow so nothing shifts.
 */
import type { ReactNode } from "react";
import { Mail, MessageSquareText, Phone } from "lucide-react";
import type { Choice, FieldDef } from "@/lib/inquiry-forms/types";
import { CONTACT_PREFERENCE_CHOICES } from "@/lib/inquiry-forms/definition";
import { otherSelected } from "./flow";
import {
  FieldShell,
  GroupShell,
  describedBy,
  errorDomId,
  fieldDomId,
  helpDomId,
  stringValue,
  type FieldInputProps,
} from "./field-shell";

const OTHER = "__other";

function OtherInput({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const key = `${field.key}${OTHER}`;
  return (
    <div className="iqf-other">
      <label className="iqf-sublabel" htmlFor={fieldDomId(key)}>
        Please specify
      </label>
      <input
        id={fieldDomId(key)}
        name={key}
        type="text"
        className="iqf-input"
        value={value}
        maxLength={200}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectInput({ field, answers, error, onChange, onBlur }: FieldInputProps) {
  const choices = field.choices ?? [];
  const value = stringValue(answers[field.key]);
  const showOther = otherSelected(field, answers);
  return (
    <FieldShell field={field} error={error}>
      <select
        id={fieldDomId(field.key)}
        name={field.key}
        className="iqf-select"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-required={field.required ? true : undefined}
        aria-describedby={describedBy(field, error)}
        onChange={(e) => onChange(field.key, e.target.value || null)}
        onBlur={() => onBlur(field.key)}
      >
        <option value="">{field.placeholder?.trim() || "Choose one"}</option>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {showOther ? (
        <OtherInput
          field={field}
          value={stringValue(answers[`${field.key}${OTHER}`])}
          onChange={(v) => onChange(`${field.key}${OTHER}`, v)}
        />
      ) : null}
    </FieldShell>
  );
}

function ChoiceCard({
  type,
  name,
  id,
  checked,
  invalid,
  describedById,
  label,
  description,
  icon,
  onToggle,
}: {
  type: "radio" | "checkbox";
  name: string;
  id?: string;
  checked: boolean;
  invalid: boolean;
  describedById?: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  onToggle: () => void;
}) {
  return (
    <label className="iqf-choice" data-checked={checked ? "true" : "false"} data-invalid={invalid ? "true" : undefined}>
      <input
        id={id}
        type={type}
        name={name}
        className="iqf-mark"
        checked={checked}
        aria-invalid={type === "checkbox" && invalid ? true : undefined}
        aria-describedby={describedById}
        onChange={onToggle}
      />
      {icon}
      <span className="iqf-choice-text">
        <span className="iqf-choice-label">{label}</span>
        {description ? <span className="iqf-choice-desc">{description}</span> : null}
      </span>
    </label>
  );
}

/** radio, or checkbox WITH choices (multi-select). The parent validates choice fields on change. */
export function ChoiceGroup({ field, answers, error, onChange }: FieldInputProps) {
  const choices: Choice[] = field.choices ?? [];
  const multi = field.type === "checkbox";
  const layout = field.layout ?? (multi ? "chips" : "list");
  const raw = answers[field.key];
  const selected = multi ? (Array.isArray(raw) ? raw : []) : typeof raw === "string" ? [raw] : [];
  const showOther = otherSelected(field, answers);
  const name = `iqf-${field.key}`;
  const errId = error ? errorDomId(field.key) : undefined;

  const toggle = (value: string) => {
    if (!multi) {
      onChange(field.key, value);
    } else {
      const set = new Set(selected);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      // keep the form's own option order
      onChange(
        field.key,
        choices.map((c) => c.value).filter((v) => set.has(v)),
      );
    }
  };

  return (
    <GroupShell field={field} error={error} role={multi ? undefined : "radiogroup"}>
      <div className="iqf-choices" data-layout={layout}>
        {choices.map((c, i) => (
          <ChoiceCard
            key={c.value}
            type={multi ? "checkbox" : "radio"}
            name={name}
            id={i === 0 ? fieldDomId(field.key) : undefined}
            checked={selected.includes(c.value)}
            invalid={Boolean(error)}
            describedById={multi ? errId : undefined}
            label={c.label}
            description={layout === "cards" ? c.description : undefined}
            onToggle={() => toggle(c.value)}
          />
        ))}
      </div>
      {showOther ? (
        <OtherInput
          field={field}
          value={stringValue(answers[`${field.key}${OTHER}`])}
          onChange={(v) => onChange(`${field.key}${OTHER}`, v)}
        />
      ) : null}
    </GroupShell>
  );
}

/** checkbox WITHOUT choices: one yes/no box whose text is the field label. */
export function ConsentCheckbox({ field, answers, error, onChange }: FieldInputProps) {
  const checked = answers[field.key] === true;
  return (
    <div className="iqf-field" data-width={field.width} data-field-key={field.key}>
      <label className="iqf-choice" data-checked={checked ? "true" : "false"} data-invalid={error ? "true" : undefined}>
        <input
          id={fieldDomId(field.key)}
          type="checkbox"
          name={field.key}
          className="iqf-mark"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-required={field.required ? true : undefined}
          aria-describedby={describedBy(field, error)}
          onChange={(e) => onChange(field.key, e.target.checked)}
        />
        <span className="iqf-choice-text">
          <span className="iqf-choice-label">{field.label}</span>
          {field.help?.trim() ? (
            <span id={helpDomId(field.key)} className="iqf-choice-desc">
              {field.help}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <p id={errorDomId(field.key)} className="iqf-error">
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

function contactIcon(value: string) {
  if (value === "email") return <Mail size={20} aria-hidden="true" className="iqf-choice-icon" />;
  if (value === "text") return <MessageSquareText size={20} aria-hidden="true" className="iqf-choice-icon" />;
  return <Phone size={20} aria-hidden="true" className="iqf-choice-icon" />;
}

/** Email / Text message / Phone call: the fixed options every contact_preference field accepts. */
export function ContactPreferenceInput({ field, answers, error, onChange }: FieldInputProps) {
  const options = CONTACT_PREFERENCE_CHOICES;
  const value = typeof answers[field.key] === "string" ? (answers[field.key] as string) : "";
  return (
    <GroupShell field={field} error={error} role="radiogroup">
      <div className="iqf-choices" data-layout="contact">
        {options.map((o, i) => (
          <ChoiceCard
            key={o.value}
            type="radio"
            name={`iqf-${field.key}`}
            id={i === 0 ? fieldDomId(field.key) : undefined}
            checked={value === o.value}
            invalid={Boolean(error)}
            label={o.label}
            icon={contactIcon(o.value)}
            onToggle={() => onChange(field.key, o.value)}
          />
        ))}
      </div>
    </GroupShell>
  );
}
