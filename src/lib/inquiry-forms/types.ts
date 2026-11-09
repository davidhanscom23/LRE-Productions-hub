/**
 * Inquiry Forms (LeadGate Hub Edition) - shared types.
 *
 * PURE module: no server-only imports, safe in client components and vitest (jsdom).
 * Every other inquiry-forms module codes against these shapes. Change them only with a
 * matching change in every caller.
 *
 * Vocabulary:
 * - Form: a multi-step public inquiry form (draft definition + published versions).
 * - Submission: one visitor's run through a form (in_progress -> completed / waitlisted /
 *   abandoned / spam).
 * - Qualify step: the "checking availability" step; the SERVER decides every verdict.
 */

// ---------------------------------------------------------------------------
// Definition (stored as jsonb on inquiry_forms.definition and inquiry_form_versions)
// ---------------------------------------------------------------------------

export const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "date",
  "time",
  "address",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "number",
  "budget",
  "contact_preference",
  "content",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * A role tells the server what an answer MEANS (CRM mapping, qualification input).
 * Each role may appear at most once per form. Field keys stay free-form.
 */
export const FIELD_ROLES = [
  "name",
  "email",
  "phone",
  "company",
  "event_date",
  "event_time",
  "event_location",
  "guest_count",
  "event_type",
  "services",
  "budget",
  "contact_preference",
  "referral_source",
  "notes",
] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

/** Which field types may carry which role (definition.ts enforces this). */
export const ROLE_FIELD_TYPES: Record<FieldRole, readonly FieldType[]> = {
  name: ["text"],
  email: ["email"],
  phone: ["phone"],
  company: ["text"],
  event_date: ["date"],
  event_time: ["time"],
  event_location: ["address", "text", "select", "radio"],
  guest_count: ["number", "select", "radio"],
  event_type: ["select", "radio"],
  services: ["checkbox", "select", "radio"],
  budget: ["budget"],
  contact_preference: ["contact_preference"],
  referral_source: ["select", "radio", "text"],
  notes: ["textarea", "text"],
};

export interface Choice {
  /** Stable stored value, unique within the field. */
  value: string;
  label: string;
  /**
   * Radio, checkbox or select (at most one per field): reveals a free-text box stored as
   * `${fieldKey}__other`. The spec presets put "Other" on dropdowns too.
   */
  isOther?: boolean;
  /** Optional one-line description under the label on card layouts. */
  description?: string;
}

/** Show a field only when an EARLIER field's answer matches. */
export interface ShowIf {
  fieldKey: string;
  op: "equals" | "not_equals" | "includes" | "not_includes" | "answered";
  values?: string[];
}

export interface BudgetTier {
  id: string;
  label: string;
  min?: number | null;
  max?: number | null;
  /** false = below what the business can usually do (scores lower; may stop under strict_stop). */
  acceptable: boolean;
}

export interface BudgetConfig {
  mode: "tiers" | "slider";
  tiers?: BudgetTier[];
  slider?: { min: number; max: number; step: number };
  /** Slider mode: amounts below this are "not acceptable". */
  minimum?: number | null;
  /** label = record + soft message; strict_stop = block Next with belowMessage. */
  policy: "label" | "strict_stop";
  belowMessage?: string;
  allowSkip?: boolean;
}

export interface FieldDef {
  /** Stable id (uuid-like), never shown. */
  id: string;
  /** Unique per form, /^[a-z][a-z0-9_]{0,47}$/, never ends with "__other" or "__end". */
  key: string;
  type: FieldType;
  role?: FieldRole | null;
  label: string;
  placeholder?: string;
  help?: string;
  required: boolean;
  width: "full" | "half";
  /**
   * select | radio | checkbox (checkbox with choices = multi-select; without = single consent box).
   * contact_preference fields ignore stored choices: their options are fixed by
   * CONTACT_PREFERENCE_CHOICES in definition.ts (values "email" | "text" | "phone").
   */
  choices?: Choice[];
  /** Presentation for radio/checkbox. */
  layout?: "list" | "cards" | "chips";
  /** number: inclusive bounds. */
  min?: number | null;
  max?: number | null;
  /** text/textarea length rules. */
  minLength?: number | null;
  maxLength?: number | null;
  /** time: also collect an end time, stored as `${key}__end` ("HH:MM"). */
  showEndTime?: boolean;
  budget?: BudgetConfig;
  /** content: a static text block, no answer. */
  content?: { text: string; tone?: "info" | "muted" };
  showIf?: ShowIf | null;
}

export type CheckKind = "date" | "location";

export interface StepDef {
  id: string;
  kind: "fields" | "qualify";
  title: string;
  description?: string;
  /** Overrides the Next button label (default: next step's title, last step: settings.submitLabel). */
  buttonText?: string;
  /** Short label for the progress bar (default: title). */
  progressLabel?: string;
  /** [] for qualify steps. */
  fields: FieldDef[];
  /** qualify steps only. */
  checks?: CheckKind[];
}

export interface FormDefinition {
  version: 1;
  steps: StepDef[];
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export type BudgetAnswer =
  | { type: "tier"; tierId: string }
  | { type: "amount"; amount: number }
  | { type: "skip" };

/**
 * Stored answer values. Dates are wall-calendar "YYYY-MM-DD" strings, times "HH:MM" (24 h).
 * Companion keys: `${key}__other` (radio/checkbox "Other" text), `${key}__end` (time end).
 */
export type AnswerValue = string | number | boolean | string[] | BudgetAnswer | null;
export type Answers = Record<string, AnswerValue>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type DateUnavailableAction = "change_date" | "alternatives" | "waitlist" | "continue";

/** Per form. `notify` is SERVER-ONLY and never reaches the public bundle. */
export interface FormSettings {
  /** Brand key from the hub adapter (e.g. "vident"). */
  brand: string;
  /** Hex accent for buttons, progress and selected cards (contrast-checked in the editor). */
  accentColor: string;
  headline?: string;
  subheadline?: string;
  /** Last step's button label. */
  submitLabel: string;
  thankYou: { title: string; message: string };
  waitlistThankYou: { title: string; message: string };
  /** http(s) only; when set the visitor (or the whole host page when embedded) goes here after submit. */
  redirectUrl?: string | null;
  qualify: {
    /** Confetti + popup when the date is "available" and location is pass/risky. */
    celebrate: boolean;
    popupTitle: string;
    popupSubtitle: string;
    timings: {
      messageIntervalMs: number;
      minCheckMs: number;
      preCelebrationMs: number;
      popupMs: number;
    };
    /** Line shown under good news (LeadGate urgency presets), or null. */
    urgency: string | null;
    dateLoadingMessages: string[];
    locationLoadingMessages: string[];
  };
  onDateUnavailable: { actions: DateUnavailableAction[]; message: string };
  onLocationFail: { action: "continue" | "referral"; message: string };
  referral?: {
    title: string;
    message: string;
    links: { label: string; url: string }[];
  } | null;
  confirmationEmail: { enabled: boolean; subject: string; intro: string };
  notify: { recipients: string[]; inApp: boolean };
  /**
   * Who owns a finished inquiry, by the event type choice VALUE (role event_type). The owner
   * becomes the CRM record's owner (when they have a hub login) and gets the staff email.
   */
  ownerByEventType: Record<string, string>;
  /** One-way copies of each finished inquiry to the systems the hub is replacing. SERVER-ONLY. */
  copies: FormCopies;
  /** Post a `submitted` message so the host page can fire its own conversion tags. */
  hostEvent: boolean;
  /** Optional fun per-step labels, e.g. "Getting warmed up...". */
  progressHype?: string[] | null;
}

export type PublicFormSettings = Omit<FormSettings, "notify" | "confirmationEmail" | "ownerByEventType" | "copies">;

/** Copy to LeadLeaf (GoHighLevel) exactly as the website's own contact form sends it (external form event). */
export interface GhlCopySettings {
  enabled: boolean;
  /** GoHighLevel location id and tracking id, as the website's form sends them. */
  locationId: string;
  trackingId: string;
  /** The form name GoHighLevel already files these leads under, e.g. "High 5 Contact Form". */
  formId: string;
  /** The website page the form replaces; sent as the page when the embed page is unknown. */
  siteUrl: string;
  /** formData key and label for the full answers text, e.g. contact.event_details / Event Details. */
  notesKey: string;
  notesLabel: string;
  /** Optional custom field keys the website's form also sends. */
  eventTypeKey: string | null;
  servicesKey: string | null;
}

export interface FormCopies {
  ghl: GhlCopySettings | null;
}

/** Singleton business settings (inquiry_settings.business). SERVER-ONLY except the parts copied into the bundle. */
export interface BusinessSettings {
  timezone: "America/New_York";
  homeBase: { label: string; address: string; lat: number | null; lng: number | null };
  location: {
    enabled: boolean;
    /** Miles from home base (straight line x roadFactor unless a Google key gives driving miles). */
    zones: { passMiles: number; riskyMiles: number; talkMiles: number; maxMiles: number | null };
    roadFactor: number;
    messages: { pass: string; risky: string; talk: string; fail: string; unverified: string };
  };
  availability: {
    /** bookings = compare hub bookings to capacity; open = never block (soft "looks open"); off = no date check. */
    mode: "bookings" | "open" | "off";
    capacity: {
      source: "staff" | "fixed" | "none";
      /** staff: hub departments whose active, not-off people count as capacity. */
      departments?: string[];
      fixed?: number | null;
    };
    blackouts: { start: string; end: string; label?: string }[];
    minNoticeDays: number | null;
    messages: {
      available: string;
      open: string;
      limited: string;
      unavailable: string;
      unknown: string;
      tooSoon: string;
      blackout: string;
    };
  };
  abandonment: { alertStaff: boolean; delayMinutes: number };
  spam: { turnstile: boolean; maxCompletesPerEmailPerDay: number; maxStartsPerIpPerHour: number };
  /** Optional emoji prefix for lead-facing email subjects (LeadGate "emoji tactic"). */
  emojiPrefix: string | null;
}

// ---------------------------------------------------------------------------
// Brand + public bundle
// ---------------------------------------------------------------------------

export interface BrandProfile {
  key: string;
  name: string;
  /** Absolute or root-relative URL. */
  logoUrl: string | null;
  /** true when the logo is light and needs a dark band behind it. */
  logoOnDark: boolean;
  siteUrl: string | null;
  privacyUrl: string | null;
  phone: string | null;
  email: string | null;
  /** Default accent for new forms of this brand. */
  accentColor: string;
  /** Legal footer line, e.g. "Vident Productions, Inc." */
  legalLine: string | null;
}

/** Everything the public page needs. Built server-side; never includes notify recipients or secrets. */
export interface PublicFormBundle {
  formId: string;
  slug: string;
  name: string;
  versionId: string | null;
  definition: FormDefinition;
  settings: PublicFormSettings;
  brand: BrandProfile;
  /** Copied from business settings so the client can label results while it animates. */
  turnstileSiteKey: string | null;
  /** Staff dry run of the DRAFT: nothing is saved, qualify uses the admin preview endpoint. */
  preview: boolean;
}

// ---------------------------------------------------------------------------
// Qualification (server-decided)
// ---------------------------------------------------------------------------

export type DateResult =
  | "available"
  | "open"
  | "limited"
  | "unavailable"
  | "blackout"
  | "too_soon"
  | "unknown"
  | "skipped";

export type LocationResult = "pass" | "risky" | "talk" | "fail" | "unverified" | "skipped";

export interface DateVerdict {
  result: DateResult;
  /** The date that was checked ("YYYY-MM-DD") or null when none was given. */
  checkedFor: string | null;
  message: string;
  /** Up to 3 nearby "YYYY-MM-DD" dates that check as available/open. */
  alternatives?: string[];
  checkedAt: string;
}

export interface LocationVerdict {
  result: LocationResult;
  message: string;
  /** For staff only; never rendered to visitors. */
  miles?: number | null;
  confidence?: "high" | "medium" | "low" | null;
  query?: string | null;
  checkedAt: string;
}

export interface Qualification {
  date?: DateVerdict;
  location?: LocationVerdict;
  budget?: { passed: boolean | null; tierId?: string | null; amount?: number | null };
  altDateChosen?: boolean;
  /** The suggested date the credit is for (the credit drops when the visitor moves off it). */
  altDate?: string;
}

export type ScoreLabel = "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  msclkid?: string;
  /** Host page URL (embedded) or form page URL (standalone), query kept. */
  page_url?: string;
  host_domain?: string;
  referrer?: string;
  /** First-touch landing URL remembered by the embed script (30 days). */
  landing_url?: string;
}

export const ATTRIBUTION_KEYS: readonly (keyof Attribution)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "page_url",
  "host_domain",
  "referrer",
  "landing_url",
];

// ---------------------------------------------------------------------------
// Public API contract (route handlers under /api/inquire/*)
// ---------------------------------------------------------------------------

export interface StartRequest {
  formSlug: string;
  /** Answers of the FIRST step only. */
  answers: Answers;
  attribution: Attribution;
  /** Honeypot: must be empty. */
  hp?: string;
  /** ms between first render and this request (bots are instant). */
  elapsedMs: number;
  turnstileToken?: string | null;
}
export interface StartResponse {
  ok: true;
  submissionId: string;
  /** Capability for every later call; the server stores only its sha256. */
  token: string;
  currentStep: number;
}

export interface SaveRequest {
  token: string;
  /** Index of the step whose answers are being saved. */
  stepIndex: number;
  answers: Answers;
}
export interface SaveResponse {
  ok: true;
  currentStep: number;
}

export interface QualifyRequest {
  token: string;
}
export interface QualifyResponse {
  ok: true;
  qualification: Qualification;
  /** Server verdict: show confetti + popup. */
  celebrate: boolean;
  urgency: string | null;
}

/** POST /api/inquire/[id]/ping (JSON, or a sendBeacon text/plain JSON body). */
export interface PingRequest {
  token: string;
}

/** POST /api/inquire/view (sendBeacon text/plain JSON). Either key identifies the form. */
export interface ViewRequest {
  formSlug?: string;
  formId?: string;
}

/** POST /api/inquire/preview/qualify: admin dry run of the DRAFT, nothing is stored. */
export interface PreviewQualifyRequest {
  formId?: string;
  formSlug?: string;
  /** Answers collected so far in the preview (all steps). */
  answers: Answers;
}

export interface CompleteRequest {
  token: string;
  /** Answers of the LAST step (earlier steps were saved already). */
  answers: Answers;
  ending: "completed" | "waitlisted";
  turnstileToken?: string | null;
}
export interface CompleteResponse {
  ok: true;
  ending: {
    kind: "completed" | "waitlisted";
    title: string;
    message: string;
    redirectUrl: string | null;
  };
}

export interface ErrorResponse {
  ok: false;
  error: string;
  /** Per-field messages keyed by field key. */
  fieldErrors?: Record<string, string>;
  /** true = the visitor can try again (network/db hiccup). */
  retryable?: boolean;
  /** The step whose fields `fieldErrors` belong to, so the client can jump back to it. */
  stepIndex?: number;
}

// ---------------------------------------------------------------------------
// Submissions (DB row shape, server side)
// ---------------------------------------------------------------------------

export type SubmissionStage = "in_progress" | "completed" | "waitlisted" | "abandoned" | "spam";

export interface SubmissionRow {
  id: string;
  form_id: string;
  version_id: string | null;
  stage: SubmissionStage;
  current_step: number;
  total_steps: number;
  answers: Answers;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  event_date: string | null;
  event_location: string | null;
  guest_count: number | null;
  qualification: Qualification;
  score: number | null;
  score_label: ScoreLabel | null;
  attribution: Attribution;
  crm_ref: Record<string, string>;
  spam_reason: string | null;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
  abandon_notified_at: string | null;
  staff_notified_at: string | null;
  confirmation_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What the CRM adapter needs, derived purely from definition + answers + qualification. */
export interface CrmSummary {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  eventType: string | null;
  eventDate: string | null;
  eventTimeStart: string | null;
  eventTimeEnd: string | null;
  eventLocation: string | null;
  guestCount: number | null;
  guestLabel: string | null;
  services: string[];
  budgetLabel: string | null;
  budgetLow: number | null;
  referral: string | null;
  contactPreference: string | null;
  notes: string | null;
  scoreLabel: ScoreLabel | null;
  ending: "completed" | "waitlisted" | "partial";
}

// ---------------------------------------------------------------------------
// Embed protocol (postMessage between /inquire/[slug]?embed=1 and /inquire/embed.js)
// ---------------------------------------------------------------------------

export const EMBED_MESSAGE_SOURCE = "inquiry-forms" as const;
export const EMBED_HOST_SOURCE = "inquiry-forms-host" as const;

export type FormToHostMessage =
  | { source: typeof EMBED_MESSAGE_SOURCE; v: 1; slug: string; type: "ready" }
  | { source: typeof EMBED_MESSAGE_SOURCE; v: 1; slug: string; type: "height"; height: number }
  | { source: typeof EMBED_MESSAGE_SOURCE; v: 1; slug: string; type: "step"; index: number; total: number }
  | {
      source: typeof EMBED_MESSAGE_SOURCE;
      v: 1;
      slug: string;
      type: "submitted";
      ending: "completed" | "waitlisted";
      formName: string;
    }
  | { source: typeof EMBED_MESSAGE_SOURCE; v: 1; slug: string; type: "redirect"; url: string };

export type HostToFormMessage = { source: typeof EMBED_HOST_SOURCE; v: 1; type: "redirect-ack" };
