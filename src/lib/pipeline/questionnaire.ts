/** Default client questionnaire for shared CRM projects. */

export type CrmQuestionKey =
  | "guest_count"
  | "event_style"
  | "ceremony_reception"
  | "vendor_contacts"
  | "special_requests";

export type CrmQuestionDef = {
  key: CrmQuestionKey;
  label: string;
  hint: string;
  /** textarea vs single-line */
  multiline?: boolean;
  placeholder?: string;
};

export const CRM_QUESTIONS: CrmQuestionDef[] = [
  {
    key: "guest_count",
    label: "Guest count",
    hint: "Approximate number of guests.",
    placeholder: "e.g. 120",
  },
  {
    key: "event_style",
    label: "Style / vibe",
    hint: "Mood, must-haves, or references that matter most.",
    placeholder: "e.g. romantic garden, modern black-tie",
  },
  {
    key: "ceremony_reception",
    label: "Ceremony & reception",
    hint: "Timing, locations, and flow of the day.",
    multiline: true,
    placeholder: "Ceremony at 4pm outdoors; cocktail hour; reception indoors…",
  },
  {
    key: "vendor_contacts",
    label: "Other vendors",
    hint: "Planner, florist, DJ, venue contact — whoever we should know.",
    multiline: true,
    placeholder: "Name · role · phone or email",
  },
  {
    key: "special_requests",
    label: "Special requests",
    hint: "Anything else we should plan for.",
    multiline: true,
  },
];

export const CRM_QUESTION_KEYS = CRM_QUESTIONS.map((q) => q.key);

export function isCrmQuestionKey(v: unknown): v is CrmQuestionKey {
  return CRM_QUESTIONS.some((q) => q.key === v);
}

export function crmQuestionLabel(key: string): string {
  return CRM_QUESTIONS.find((q) => q.key === key)?.label ?? key;
}

export type CrmQuestionnaireAnswers = Partial<Record<CrmQuestionKey, string>>;

export type CrmQuestionnaireState = {
  answers: CrmQuestionnaireAnswers;
  submitted_at: string | null;
  updated_at: string | null;
};

const MAX_ANSWER_CHARS = 4000;

/** Keep only known keys; trim; drop empties; cap length. */
export function sanitizeCrmAnswers(
  raw: Record<string, unknown> | null | undefined,
): CrmQuestionnaireAnswers {
  const out: CrmQuestionnaireAnswers = {};
  if (!raw || typeof raw !== "object") return out;
  for (const q of CRM_QUESTIONS) {
    const v = raw[q.key];
    if (typeof v !== "string") continue;
    const trimmed = v.trim().slice(0, MAX_ANSWER_CHARS);
    if (trimmed) out[q.key] = trimmed;
  }
  return out;
}

export function hasAnyCrmAnswer(answers: CrmQuestionnaireAnswers): boolean {
  return CRM_QUESTIONS.some((q) => Boolean(answers[q.key]?.trim()));
}
