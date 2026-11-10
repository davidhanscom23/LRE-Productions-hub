/**
 * Inquiry Forms builder - field catalog: human labels for types and roles, and the
 * "Add field" templates with sensible defaults. Pure data, no React.
 */
import { BUILDER_COPY, ROLE_HELP } from "@/lib/inquiry-forms/hub-copy";
import { CONTACT_PREFERENCE_CHOICES, FIELD_ROLE_LABELS, keyFromLabel } from "@/lib/inquiry-forms/definition";
import {
  ROLE_FIELD_TYPES,
  type BudgetConfig,
  type Choice,
  type FieldDef,
  type FieldRole,
  type FieldType,
} from "@/lib/inquiry-forms/types";

/** Same fixed options the renderer and the validator use. */
export { CONTACT_PREFERENCE_CHOICES };

export const TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  email: "Email",
  phone: "Phone",
  date: "Date",
  time: "Time",
  address: "Address or place",
  textarea: "Long text",
  select: "Dropdown",
  radio: "Single choice",
  checkbox: "Multiple choice",
  number: "Number",
  budget: "Budget",
  contact_preference: "Contact preference",
  content: "Text block",
};

/** Type label that also knows a checkbox with no choices is a single consent box. */
export function fieldTypeLabel(field: Pick<FieldDef, "type" | "choices">): string {
  if (field.type === "checkbox" && (field.choices?.length ?? 0) === 0) return "Single checkbox";
  return TYPE_LABELS[field.type];
}

/** Role names match the validator's messages (definition.ts FIELD_ROLE_LABELS). */
export const ROLE_LABELS: Record<FieldRole, string> = FIELD_ROLE_LABELS;

/**
 * What a role does, in the owner's words (shown under the role picker). Hub-specific (hub-copy.ts):
 * the Y? hub writes a Leads card, the LRE hub a HoneyBook project, and LRE never says "lead".
 */
export { ROLE_HELP };

export function rolesForType(type: FieldType): FieldRole[] {
  return (Object.keys(ROLE_FIELD_TYPES) as FieldRole[]).filter((role) =>
    ROLE_FIELD_TYPES[role].includes(type),
  );
}

/** Field types a field may switch between without losing its answers' meaning. */
export const TYPE_FAMILIES: ReadonlyArray<readonly FieldType[]> = [
  ["text", "textarea"],
  ["radio", "select", "checkbox"],
];

export function typeFamily(type: FieldType): readonly FieldType[] | null {
  return TYPE_FAMILIES.find((family) => family.includes(type)) ?? null;
}

/** True when the field stores an answer (content blocks do not). */
export function isAnswerable(field: Pick<FieldDef, "type">): boolean {
  return field.type !== "content";
}

export function usesChoices(type: FieldType): boolean {
  return type === "select" || type === "radio" || type === "checkbox";
}

export function usesPlaceholder(type: FieldType): boolean {
  return (
    type === "text" ||
    type === "email" ||
    type === "phone" ||
    type === "address" ||
    type === "textarea" ||
    type === "number" ||
    type === "select"
  );
}

// Add field templates

export type FieldTemplateId =
  | "full_name"
  | "email"
  | "phone"
  | "company"
  | "event_date"
  | "event_time"
  | "event_location"
  | "guest_count"
  | "event_type"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "short_text"
  | "long_text"
  | "number"
  | "budget"
  | "contact_preference"
  | "text_block";

/** A new field before it gets its id, key and (free) role. */
export interface FieldTemplateDraft extends Omit<FieldDef, "id" | "key" | "role"> {
  preferredRole?: FieldRole;
}

export interface FieldTemplate {
  id: FieldTemplateId;
  /** Menu label. */
  label: string;
  /** One line under the menu label. */
  hint: string;
  type: FieldType;
  build: () => FieldTemplateDraft;
}

function starterChoices(labels: string[], otherLast = false): Choice[] {
  const taken = new Set<string>();
  return labels.map((label, i) => {
    const value = keyFromLabel(label, taken);
    taken.add(value);
    const choice: Choice = { value, label };
    if (otherLast && i === labels.length - 1) choice.isOther = true;
    return choice;
  });
}

export function defaultBudgetConfig(newTierId: () => string): BudgetConfig {
  return {
    mode: "tiers",
    tiers: [
      { id: newTierId(), label: "Under $1,000", min: null, max: 999, acceptable: false },
      { id: newTierId(), label: "$1,000 - $2,500", min: 1000, max: 2500, acceptable: true },
      { id: newTierId(), label: "$2,500 - $5,000", min: 2500, max: 5000, acceptable: true },
      { id: newTierId(), label: "$5,000+", min: 5000, max: null, acceptable: true },
    ],
    slider: { min: 500, max: 10000, step: 250 },
    minimum: null,
    policy: "label",
    belowMessage: "Thanks for sharing. We'll suggest the options that fit your budget best.",
    allowSkip: true,
  };
}

export const FIELD_TEMPLATES: Record<FieldTemplateId, FieldTemplate> = {
  full_name: {
    id: "full_name",
    label: "Full name",
    hint: BUILDER_COPY.fullNameHint,
    type: "text",
    build: () => ({ type: "text", label: "Full name", required: true, width: "half", preferredRole: "name" }),
  },
  email: {
    id: "email",
    label: "Email",
    hint: "Checked for a valid address",
    type: "email",
    build: () => ({ type: "email", label: "Email", required: true, width: "half", preferredRole: "email" }),
  },
  phone: {
    id: "phone",
    label: "Phone",
    hint: "Mobile number",
    type: "phone",
    build: () => ({ type: "phone", label: "Mobile phone", required: true, width: "half", preferredRole: "phone" }),
  },
  company: {
    id: "company",
    label: "Company",
    hint: "Business or organization",
    type: "text",
    build: () => ({ type: "text", label: "Company", required: false, width: "half", preferredRole: "company" }),
  },
  event_date: {
    id: "event_date",
    label: "Event date",
    hint: "Past dates are blocked",
    type: "date",
    build: () => ({ type: "date", label: "Event date", required: true, width: "half", preferredRole: "event_date" }),
  },
  event_time: {
    id: "event_time",
    label: "Time",
    hint: "Start time, end time optional",
    type: "time",
    build: () => ({
      type: "time",
      label: "Start and end time",
      required: false,
      width: "half",
      showEndTime: true,
      preferredRole: "event_time",
    }),
  },
  event_location: {
    id: "event_location",
    label: "Venue or location",
    hint: "Used by the location check",
    type: "address",
    build: () => ({
      type: "address",
      label: "Venue or city",
      placeholder: "Venue name or city",
      required: true,
      width: "half",
      preferredRole: "event_location",
    }),
  },
  guest_count: {
    id: "guest_count",
    label: "Guest count",
    hint: "A number from 1 to 5,000",
    type: "number",
    build: () => ({
      type: "number",
      label: "Guest count",
      required: false,
      width: "half",
      min: 1,
      max: 5000,
      preferredRole: "guest_count",
    }),
  },
  event_type: {
    id: "event_type",
    label: "Event type",
    hint: "Cards with an Other option",
    type: "radio",
    build: () => ({
      type: "radio",
      label: "Type of event",
      required: true,
      width: "full",
      layout: "cards",
      choices: starterChoices(["Wedding", "Corporate event", "Birthday or milestone", "Other"], true),
      preferredRole: "event_type",
    }),
  },
  single_choice: {
    id: "single_choice",
    label: "Single choice",
    hint: "Pick one from a list",
    type: "radio",
    build: () => ({
      type: "radio",
      label: "Pick one",
      required: false,
      width: "full",
      layout: "list",
      choices: starterChoices(["Option 1", "Option 2", "Option 3"]),
    }),
  },
  multiple_choice: {
    id: "multiple_choice",
    label: "Multiple choice",
    hint: "Pick any number",
    type: "checkbox",
    build: () => ({
      type: "checkbox",
      label: "Pick all that apply",
      required: false,
      width: "full",
      layout: "chips",
      choices: starterChoices(["Option 1", "Option 2", "Option 3"]),
    }),
  },
  dropdown: {
    id: "dropdown",
    label: "Dropdown",
    hint: "Compact list for many options",
    type: "select",
    build: () => ({
      type: "select",
      label: "Choose one",
      required: false,
      width: "half",
      choices: starterChoices(["Option 1", "Option 2", "Option 3"]),
    }),
  },
  short_text: {
    id: "short_text",
    label: "Short text",
    hint: "One line",
    type: "text",
    build: () => ({ type: "text", label: "Short answer", required: false, width: "full" }),
  },
  long_text: {
    id: "long_text",
    label: "Long text",
    hint: "A few sentences",
    type: "textarea",
    build: () => ({
      type: "textarea",
      label: "Anything else we should know?",
      required: false,
      width: "full",
      maxLength: 2000,
      preferredRole: "notes",
    }),
  },
  number: {
    id: "number",
    label: "Number",
    hint: "Whole or decimal number",
    type: "number",
    build: () => ({ type: "number", label: "Number", required: false, width: "half" }),
  },
  budget: {
    id: "budget",
    label: "Budget",
    hint: "Price ranges or a slider",
    type: "budget",
    // Tier ids are filled in by createFieldFromTemplate (needs newId).
    build: () => ({ type: "budget", label: "Budget", required: false, width: "full", preferredRole: "budget" }),
  },
  contact_preference: {
    id: "contact_preference",
    label: "Contact preference",
    hint: "Email, text or call",
    type: "contact_preference",
    build: () => ({
      type: "contact_preference",
      label: "How should we reach you?",
      required: true,
      width: "full",
      preferredRole: "contact_preference",
    }),
  },
  text_block: {
    id: "text_block",
    label: "Text block",
    hint: "A note, no answer",
    type: "content",
    build: () => ({
      type: "content",
      label: "Text block",
      required: false,
      width: "full",
      content: { text: "Add a short note for visitors here.", tone: "info" },
    }),
  },
};

export const FIELD_TEMPLATE_GROUPS: ReadonlyArray<{ id: string; label: string; templates: FieldTemplateId[] }> = [
  { id: "contact", label: "Contact", templates: ["full_name", "email", "phone", "company"] },
  {
    id: "event",
    label: "Event",
    templates: ["event_date", "event_time", "event_location", "guest_count", "event_type"],
  },
  { id: "choices", label: "Choices", templates: ["single_choice", "multiple_choice", "dropdown"] },
  { id: "text", label: "Text", templates: ["short_text", "long_text", "number"] },
  { id: "special", label: "Special", templates: ["budget", "contact_preference", "text_block"] },
];
