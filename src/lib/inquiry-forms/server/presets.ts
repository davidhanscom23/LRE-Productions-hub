import "server-only";

/**
 * Inquiry Forms - LRE hub presets: brand profiles, business defaults and the two starter forms.
 * Spec section 5 (forms) and section 4 (LRE availability: "open" mode, no location check).
 *
 * Choice values and budget tier ids are generated with keyFromLabel (snake_case of the label, the
 * same rule the builder uses), and every showIf uses those generated values, so presets.test.ts can
 * prove each starter form passes validateDefinition unchanged.
 */
import { keyFromLabel } from "../definition";
import { mergeFormSettings } from "../defaults";
import type {
  BrandProfile,
  BudgetTier,
  BusinessSettings,
  Choice,
  FieldDef,
  FormDefinition,
  FormSettings,
  StepDef,
} from "../types";
import type { DeepPartial } from "./bundle-core";

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const DEFAULT_BRAND_KEY = "lre-productions";

const PHONE = "401-816-5496";

/** Hub brand red (globals.css --brand); the form editor contrast-checks it for white text. */
export const LRE_RED = "#b01418";
/**
 * The same red one step darker, so white button text reads at 4.5:1 or better (the raw bronze is
 * 4.29:1). The public form darkens a light accent for its buttons anyway; starting the starter form
 * here keeps its editor free of the "hard to read" warning.
 */
export const LRE_RED_AA = "#b01418";
export const LRE_AV_RED = "#c00000";

/**
 * Brand profiles. Privacy links were checked live on 05-Nov-2026: both pages answer 200 and render a
 * real "Privacy Policy" (a made-up path on the same sites renders a 404 page instead).
 */
export const BRANDS: BrandProfile[] = [
  {
    key: "lre-productions",
    name: "LRE Productions",
    // public/logo.png is the WHITE wordmark: the form header paints a dark band behind it.
    logoUrl: "/logo.png",
    logoOnDark: true,
    siteUrl: "https://lreproductions.com",
    privacyUrl: "https://lreproductions.com/privacy-policy",
    phone: PHONE,
    email: "hello@lreproductions.com",
    accentColor: LRE_RED,
    legalLine: "LRE Productions, Inc.",
  },
  {
    key: "lre-av",
    name: "LRE Audiovisual",
    // No LRE Audiovisual logo file in the hub: the form shows a text wordmark.
    logoUrl: null,
    logoOnDark: false,
    siteUrl: "https://lreproductions.com",
    privacyUrl: "https://lreproductions.com/privacy-policy",
    phone: PHONE,
    email: "hello@lreproductions.com",
    accentColor: LRE_AV_RED,
    legalLine: "LRE Productions, Inc.",
  },
];

// ---------------------------------------------------------------------------
// Business defaults (layered between DEFAULT_BUSINESS_SETTINGS and the saved row)
// ---------------------------------------------------------------------------

export const HUB_BUSINESS_DEFAULTS: DeepPartial<BusinessSettings> = {
  homeBase: {
    label: "LRE Productions, Tiverton",
    address: "1061 Fish Rd., Unit 1, Tiverton, RI 02878",
    // Approximate Tiverton, RI coordinates; the settings page geocode button can refine them.
    // Only used if someone turns the location check on.
    lat: 41.63,
    lng: -71.21,
  },
  // The area is a choice on the form (Newport, Providence, Boston, Plymouth, Martha's Vineyard and nearby New England, from lreproductions.com/service-areas), so there is no distance check.
  location: { enabled: false },
  // No capacity number exists in the hub, and a DMC runs several events a day: a date is "open"
  // unless an admin adds blackout dates or a minimum notice (none by default).
  availability: {
    mode: "open",
    capacity: { source: "none", departments: [], fixed: null },
  },
};

// ---------------------------------------------------------------------------
// Starter forms
// ---------------------------------------------------------------------------

export interface StarterForm {
  slug: string;
  name: string;
  brand: string;
  definition: FormDefinition;
  settings: FormSettings;
}

type ChoiceSpec = string | { label: string; isOther?: boolean };

/** Choices whose values are keyFromLabel(label), unique within the field. */
function choices(specs: ChoiceSpec[]): Choice[] {
  const taken = new Set<string>();
  return specs.map((spec) => {
    const label = typeof spec === "string" ? spec : spec.label;
    const value = keyFromLabel(label, taken);
    taken.add(value);
    const choice: Choice = { value, label };
    if (typeof spec !== "string" && spec.isOther) choice.isOther = true;
    return choice;
  });
}

/** The stored value of `label` in a field built with choices() (for showIf). */
function valueOf(field: FieldDef, label: string): string {
  const match = (field.choices ?? []).find((c) => c.label === label);
  if (!match) throw new Error(`Preset error: "${label}" is not an option of ${field.key}`);
  return match.value;
}

function tiers(specs: [label: string, min: number | null, max: number | null, acceptable: boolean][]): BudgetTier[] {
  const taken = new Set<string>();
  return specs.map(([label, min, max, acceptable]) => {
    const id = keyFromLabel(label, taken);
    taken.add(id);
    return { id, label, min, max, acceptable };
  });
}

type FieldExtras = Omit<Partial<FieldDef>, "id" | "key" | "type" | "label">;

function field(form: string, key: string, type: FieldDef["type"], label: string, extras: FieldExtras = {}): FieldDef {
  return {
    id: `${form}-${key.replace(/_/g, "-")}`,
    key,
    type,
    role: null,
    label,
    required: false,
    width: "full",
    ...extras,
  };
}

const OTHER = { label: "Other", isOther: true } as const;

/** Staff email for new inquiries: the public inbox. */
export const LRE_STAFF_INBOXES = ["hello@lreproductions.com"];
/** Who owns new inquiries by event type (one inbox for now). */
export const LRE_DIRECTORS = {
  corporate: "hello@lreproductions.com",
} as const;

/** Step 1 of both forms: who is asking. */
function contactFields(form: string): FieldDef[] {
  return [
    field(form, "full_name", "text", "Full name", { role: "name", required: true, width: "half" }),
    field(form, "phone", "phone", "Phone", { role: "phone", required: true, width: "half" }),
    field(form, "email", "email", "Email", { role: "email", required: true }),
    field(form, "company", "text", "Company", { role: "company" }),
  ];
}

// Form V1: "Get a Quote" (lreproductions.com; replaces the site's one-page "Get a Quote" form).
const v1EventType = field("v1", "event_type", "radio", "Event type", {
  role: "event_type",
  required: true,
  layout: "cards",
  choices: choices([
    "Corporate Event",
    "Incentive Trip",
    "Team Building",
    "Game Show",
    "Tradeshow",
    "Virtual or Hybrid",
    OTHER,
  ]),
});

const v1Steps: StepDef[] = [
  {
    id: "v1-step-you",
    kind: "fields",
    title: "Let's start with you",
    fields: contactFields("v1"),
  },
  {
    id: "v1-step-planning",
    kind: "fields",
    title: "What are you planning?",
    fields: [
      v1EventType,
    ],
  },
  {
    id: "v1-step-when-where",
    kind: "fields",
    title: "When and where",
    fields: [
      field("v1", "event_date", "date", "Event date", {
        role: "event_date",
        width: "half",
        help: "Not sure yet? Pick your best guess.",
      }),
      field("v1", "event_location", "select", "Area", {
        role: "event_location",
        required: true,
        choices: choices([
          "Newport, RI",
          "Providence, RI",
          "Boston, MA",
          "Plymouth, MA",
          "Martha's Vineyard, MA",
          "Somewhere else in New England",
          "Somewhere else",
          "Not sure yet",
        ]),
      }),
      field("v1", "venue", "text", "Venue if known", { width: "half" }),
      field("v1", "guest_count", "select", "Guests", {
        role: "guest_count",
        required: true,
        width: "half",
        choices: choices(["Under 50", "50 - 150", "150 - 300", "300 - 500", "500 - 1,000", "1,000+"]),
      }),
    ],
  },
  {
    id: "v1-step-availability",
    kind: "qualify",
    title: "Checking our calendar",
    fields: [],
    checks: ["date"],
  },
  {
    id: "v1-step-needs",
    kind: "fields",
    title: "What do you need?",
    fields: [
      field("v1", "services", "checkbox", "Services", {
        role: "services",
        layout: "chips",
        choices: choices([
          "Audio & Visuals",
          "Decor & Rentals",
          "Design",
          "Entertainment",
          "Experiences",
          "F&B Catering",
          "Field Marketing",
          "Groups",
          "Management",
          "Marketing",
          "Planning",
          "Social Media",
          "Sourcing",
          "Transportation",
          "Venues",
        ]),
      }),
      field("v1", "budget", "budget", "Budget", {
        role: "budget",
        budget: {
          mode: "tiers",
          policy: "label",
          allowSkip: true,
          tiers: tiers([
            ["Under $10,000", null, 9999, true],
            ["$10,000 - $25,000", 10000, 25000, true],
            ["$25,000 - $50,000", 25000, 50000, true],
            ["$50,000 - $100,000", 50000, 100000, true],
            ["$100,000+", 100000, null, true],
          ]),
        },
      }),
    ],
  },
  {
    id: "v1-step-details",
    kind: "fields",
    title: "Last details",
    fields: [
      field("v1", "notes", "textarea", "Tell us about your event", {
        role: "notes",
        required: true,
        minLength: 25,
        placeholder: "Goals, schedule, anything you already have in place...",
      }),
      field("v1", "contact_preference", "contact_preference", "How should we reach you?", { role: "contact_preference" }),
    ],
  },
];

const V1: StarterForm = {
  slug: "get-a-quote",
  name: "Get a Quote",
  brand: "lre-productions",
  definition: { version: 1, steps: v1Steps },
  settings: mergeFormSettings({
    brand: "lre-productions",
    accentColor: LRE_RED_AA,
    submitLabel: "Get a Quote",
    thankYou: {
      title: "Thank you!",
      message: "We received your inquiry and will be in touch soon to plan the details.",
    },
    // Availability mode is "open" (no capacity data), so there is no "we are available" moment.
    qualify: { celebrate: false },
    onDateUnavailable: { actions: ["change_date", "continue"] },
    // David's picks (05-Nov-26): confirmation on; staff email to hello@ with David always copied;
    // corporate event types go to the hello@ inbox (Other stays with an admin).
    confirmationEmail: { enabled: true },
    notify: { recipients: LRE_STAFF_INBOXES },
    ownerByEventType: {
      [valueOf(v1EventType, "Corporate Event")]: LRE_DIRECTORS.corporate,
      [valueOf(v1EventType, "Incentive Trip")]: LRE_DIRECTORS.corporate,
      [valueOf(v1EventType, "Team Building")]: LRE_DIRECTORS.corporate,
      [valueOf(v1EventType, "Game Show")]: LRE_DIRECTORS.corporate,
      [valueOf(v1EventType, "Tradeshow")]: LRE_DIRECTORS.corporate,
      [valueOf(v1EventType, "Virtual or Hybrid")]: LRE_DIRECTORS.corporate,
    },
  }),
};

// Form V2: "Request AV" (the lreproductions.com Audiovisual request form).
const v2Steps: StepDef[] = [
  {
    id: "v2-step-connect",
    kind: "fields",
    title: "Let's connect",
    fields: contactFields("v2"),
  },
  {
    id: "v2-step-event",
    kind: "fields",
    title: "Your event",
    fields: [
      field("v2", "event_type", "select", "Event type", {
        role: "event_type",
        required: true,
        choices: choices([
          "Conference",
          "Corporate Meeting",
          "Gala",
          "Trade Show",
          "Concert",
          OTHER,
        ]),
      }),
      field("v2", "event_date", "date", "Event date", { role: "event_date", required: true, width: "half" }),
      field("v2", "event_time", "time", "Times", { role: "event_time", width: "half", showEndTime: true }),
      field("v2", "event_location", "text", "Venue", { role: "event_location", required: true }),
      // At least 1, no upper limit (arenas and conventions run into the thousands).
      field("v2", "guest_count", "number", "Attendees", { role: "guest_count", width: "half", min: 1, max: null }),
    ],
  },
  {
    id: "v2-step-availability",
    kind: "qualify",
    title: "Checking our calendar",
    fields: [],
    checks: ["date"],
  },
  {
    id: "v2-step-needs",
    kind: "fields",
    title: "What you need",
    fields: [
      field("v2", "services", "checkbox", "AV services", {
        role: "services",
        required: true,
        layout: "chips",
        choices: choices([
          "Audio and Sound",
          "Lighting Design",
          "Video",
          "LED Walls and Projection",
          "Staging",
          "Live Stream or Broadcast",
          "Video Production",
          "Technicians",
          "Entertainment",
        ]),
      }),
      field("v2", "service_level", "radio", "Service level", {
        required: true,
        layout: "cards",
        choices: choices(["Rental only (pickup or delivery)", "Rental with technician", "Full production"]),
      }),
      field("v2", "notes", "textarea", "Tell us about your request", {
        role: "notes",
        required: true,
        minLength: 25,
        placeholder: "Tell us about your event: date, venue, and what you need.",
      }),
    ],
  },
  {
    id: "v2-step-finish",
    kind: "fields",
    title: "Last step",
    fields: [
      field("v2", "contact_preference", "contact_preference", "How should we reach you?", { role: "contact_preference" }),
    ],
  },
];

const V2: StarterForm = {
  slug: "request-av",
  name: "Request AV",
  brand: "lre-av",
  definition: { version: 1, steps: v2Steps },
  settings: mergeFormSettings({
    brand: "lre-av",
    accentColor: LRE_AV_RED,
    submitLabel: "Send Request",
    thankYou: {
      title: "Request received!",
      message: "Thank you for reaching out to LRE Audiovisual. We'll be in touch soon.",
    },
    // David's picks (05-Nov-26): confirmation on; staff email to hello@ with David always copied;
    // no event type routing (AV department).
    confirmationEmail: { enabled: true },
    notify: { recipients: LRE_STAFF_INBOXES },
  }),
};

/** "Add the starter forms" creates these LIVE with version 1 (admin action; never automatic). */
export const STARTER_FORMS: StarterForm[] = [V1, V2];
