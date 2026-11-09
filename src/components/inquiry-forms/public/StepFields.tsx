"use client";

/**
 * Inquiry Forms public renderer - the fields of one "fields" step.
 * Visibility (showIf) is evaluated live with the shared visibility module; hidden fields are not
 * rendered (and their answers are never sent, see flow.stepPayload). Half-width fields pair up on a
 * two-column grid from 640px and stack below it.
 */
import { Info } from "lucide-react";
import type { AnswerValue, Answers, FieldDef, StepDef } from "@/lib/inquiry-forms/types";
import { visibleFields } from "@/lib/inquiry-forms/visibility";
import { BudgetInput } from "./budget-input";
import { ChoiceGroup, ConsentCheckbox, ContactPreferenceInput, SelectInput } from "./choice-inputs";
import { DateInput, NumberInput, TextAreaInput, TextInput, TimeInput } from "./field-inputs";
import type { FieldInputProps } from "./field-shell";

function ContentBlock({ field }: { field: FieldDef }) {
  const text = field.content?.text?.trim() || field.label;
  if (!text) return null;
  if (field.content?.tone === "info") {
    return (
      <div className="iqf-field" data-width={field.width} data-field-key={field.key}>
        <div className="iqf-note" data-tone="info">
          <Info size={18} aria-hidden="true" />
          <span className="iqf-pre">{text}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="iqf-field" data-width={field.width} data-field-key={field.key}>
      <p className="iqf-muted-text">{text}</p>
    </div>
  );
}

function errorFor(field: FieldDef, errors: Record<string, string>): string | null {
  return errors[field.key] || errors[`${field.key}__other`] || errors[`${field.key}__end`] || null;
}

function FieldSwitch(props: FieldInputProps) {
  const { field } = props;
  switch (field.type) {
    case "text":
    case "email":
    case "phone":
    case "address":
      return <TextInput {...props} />;
    case "textarea":
      return <TextAreaInput {...props} />;
    case "number":
      return <NumberInput {...props} />;
    case "date":
      return <DateInput {...props} />;
    case "time":
      return <TimeInput {...props} />;
    case "select":
      return <SelectInput {...props} />;
    case "radio":
      return <ChoiceGroup {...props} />;
    case "checkbox":
      return field.choices && field.choices.length > 0 ? <ChoiceGroup {...props} /> : <ConsentCheckbox {...props} />;
    case "budget":
      return <BudgetInput {...props} />;
    case "contact_preference":
      return <ContactPreferenceInput {...props} />;
    case "content":
      return <ContentBlock field={field} />;
    default:
      return null;
  }
}

export function StepFields({
  step,
  answers,
  errors,
  today,
  onChange,
  onBlur,
  visibilityAnswers,
}: {
  step: StepDef;
  answers: Answers;
  errors: Record<string, string>;
  today: string;
  onChange: (key: string, value: AnswerValue) => void;
  onBlur: (key: string) => void;
  /** Answers that decide visibility (stripHidden of the whole form, as the server sees them). */
  visibilityAnswers?: Answers;
}) {
  const fields = visibleFields(step, visibilityAnswers ?? answers);
  if (fields.length === 0) return null;
  return (
    <div className="iqf-fields">
      {fields.map((field) => (
        <FieldSwitch
          key={field.id || field.key}
          field={field}
          answers={answers}
          error={errorFor(field, errors)}
          today={today}
          onChange={onChange}
          onBlur={onBlur}
        />
      ))}
    </div>
  );
}
