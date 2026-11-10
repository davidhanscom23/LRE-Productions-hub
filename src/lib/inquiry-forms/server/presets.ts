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

export const DEFAULT_BRAND_KEY = "vident-productions";

const PHONE = "904-834-1216";

/** Hub brand bronze (globals.css --brand); the form editor contrast-checks it for white text. */
export const VIDENT_BRONZE = "#9a7340";
/**
 * The same bronze one step darker, so white button text reads at 4.5:1 or better (the raw bronze is
 * 4.29:1). The public form darkens a light accent for its buttons anyway; starting the starter form
 * here keeps its editor free of the "hard to read" warning.
 */
export const VIDENT_BRONZE_AA = "#946e3d";
export const VIDENT_AV_RED = "#c00000";

/**
 * Brand profiles. Privacy links were checked live on 05-Nov-2026: both pages answer 200 and render a
 * real "Privacy Policy" (a made-up path on the same sites renders a 404 page instead).
 */
export const BRANDS: BrandProfile[] = [
  {
    key: "vident-productions",
    name: "LRE Productions",
    // public/logo.png is the WHITE wordmark: the form header paints a dark band behind it.
    logoUrl: "/logo.png",
    logoOnDark: true,
    siteUrl: "https://lreproductions.com",
    privacyUrl: "https://lreproductions.com/privacy-policy",
    phone: PHONE,
    email: "hello@lreproductions.com",
    accentColor: VIDENT_BRONZE,
    legalLine: "LRE Productions, Inc.",
  },
  {
    key: "vident-av",
    name: "LRE Audiovisual",
    // No LRE Audiovisual logo file in the hub: the form shows a text wordmark.
    logoUrl: null,
    logoOnDark: false,
    siteUrl: "https://videntaudiovisual.com",
    privacyUrl: "https://videntaudiovisual.com/privacy-policy",
    phone: PHONE,
    email: "hello@videntaudiovisual.com",
    accentColor: VIDENT_AV_RED,
    // The name the brand's own site footer uses ("(c) LRE Audiovisual. All rights reserved.").
    legalLine: "LRE Audiovisual",
  },
];

// ---------------------------------------------------------------------------
// Business defaults (layered between DEFAULT_BUSINESS_SETTINGS and the saved row)
// ---------------------------------------------------------------------------

export const HUB_BUSINESS_DEFAULTS: DeepPartial<BusinessSettings> = {
  homeBase: {
    label: "LRE Productions, Ponte Vedra",
    address: "101 Marketside Avenue, Ponte Vedra, FL 32081",
    // The same street address the Y? hub geocoded from its website JSON-LD; the settings page
    // geocode button can refine it. Only used if someone turns the location check on.
    lat: 30.24,
    lng: -81.3853,
  },
  // The area is a choice on the form (LRE covers Northeast Florida, Central Florida, Tampa and
  // Southeast Georgia), so there is no distance check.
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

/** Staff email for new inquiries: the public inbox, with David always copied (David, 05-Nov-26). */
export const VIDENT_STAFF_INBOXES = ["hello@lreproductions.com"];
/** Directors listed on lreproductions.com/contact (read 05-Nov-26). */
export const VIDENT_DIRECTORS = {
  corporate: "hello@lreproductions.com",
  weddingSocial: "hello@lreproductions.com",
  golf: "hello@lreproductions.com",
} as const;
/** GoHighLevel ids both LRE websites' contact forms send (public, read from the live sites). */
const VIDENT_GHL_LOCATION = "LsjUOxo376FX3spTvDwa";
const VIDENT_GHL_TRACKING = "tk_2ba7711add5e48fcbaeca8e803d01da4";

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
    "Wedding",
    "Social Celebration",
    "Golf Experience",
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
      field("v1", "wedding_planning_level", "radio", "Wedding planning level", {
        choices: choices([
          "Wedding Management (The Peace of Mind)",
          "Partial Planning (The Styled & Supported)",
          "Full-Service Planning (The Signature Soiree)",
          "Not sure yet",
        ]),
        showIf: { fieldKey: "event_type", op: "equals", values: [valueOf(v1EventType, "Wedding")] },
      }),
      field("v1", "golf_experience", "radio", "Golf experience", {
        choices: choices(["Tournament", "Corporate golf outing", "Golf trip or itinerary", "Putting party", "Other"]),
        showIf: { fieldKey: "event_type", op: "equals", values: [valueOf(v1EventType, "Golf Experience")] },
      }),
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
          "Ponte Vedra",
          "Jacksonville",
          "St. Augustine",
          "Amelia Island",
          "Northeast Florida",
          "Central Florida or Orlando",
          "Tampa",
          "Southeast Georgia",
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
  brand: "vident-productions",
  definition: { version: 1, steps: v1Steps },
  settings: mergeFormSettings({
    brand: "vident-productions",
    accentColor: VIDENT_BRONZE_AA,
    submitLabel: "Get a Quote",
    thankYou: {
      title: "Thank you!",
      message: "We received your inquiry and will be in touch soon to plan the details.",
    },
    // Availability mode is "open" (no capacity data), so there is no "we are available" moment.
    qualify: { celebrate: false },
    onDateUnavailable: { actions: ["change_date", "continue"] },
    // David's picks (05-Nov-26): confirmation on; staff email to hello@ with David always copied;
    // each event type routed to its director from lreproductions.com/contact (Other stays with
    // an admin); a copy to GoHighLevel exactly as the site's own form sends it (read 05-Nov-26).
    confirmationEmail: { enabled: true },
    notify: { recipients: VIDENT_STAFF_INBOXES },
    ownerByEventType: {
      [valueOf(v1EventType, "Corporate Event")]: VIDENT_DIRECTORS.corporate,
      [valueOf(v1EventType, "Incentive Trip")]: VIDENT_DIRECTORS.corporate,
      [valueOf(v1EventType, "Team Building")]: VIDENT_DIRECTORS.corporate,
      [valueOf(v1EventType, "Game Show")]: VIDENT_DIRECTORS.corporate,
      [valueOf(v1EventType, "Tradeshow")]: VIDENT_DIRECTORS.corporate,
      [valueOf(v1EventType, "Virtual or Hybrid")]: VIDENT_DIRECTORS.corporate,
      [valueOf(v1EventType, "Wedding")]: VIDENT_DIRECTORS.weddingSocial,
      [valueOf(v1EventType, "Social Celebration")]: VIDENT_DIRECTORS.weddingSocial,
      [valueOf(v1EventType, "Golf Experience")]: VIDENT_DIRECTORS.golf,
    },
    copies: {
      ghl: {
        enabled: true,
        locationId: VIDENT_GHL_LOCATION,
        trackingId: VIDENT_GHL_TRACKING,
        formId: "Contact Form",
        siteUrl: "https://lreproductions.com/contact",
        notesKey: "contact.event_details",
        notesLabel: "Event Details",
        eventTypeKey: "contact.event_type",
        servicesKey: "contact.services_needed",
      },
    },
  }),
};

// Form V2: "Request AV" (videntaudiovisual.com; replaces the site's "Send Message" form).
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
          "Wedding",
          "Gala",
          "Trade Show",
          "Concert",
          "Private Event",
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
  brand: "vident-av",
  definition: { version: 1, steps: v2Steps },
  settings: mergeFormSettings({
    brand: "vident-av",
    accentColor: VIDENT_AV_RED,
    submitLabel: "Send Request",
    thankYou: {
      title: "Request received!",
      message: "Thank you for reaching out to LRE Audiovisual. We'll be in touch soon.",
    },
    // David's picks (05-Nov-26): confirmation on; staff email to hello@ with David always copied;
    // no event type routing (AV department); a copy to GoHighLevel as videntaudiovisual.com sends it.
    confirmationEmail: { enabled: true },
    notify: { recipients: VIDENT_STAFF_INBOXES },
    copies: {
      ghl: {
        enabled: true,
        locationId: VIDENT_GHL_LOCATION,
        trackingId: VIDENT_GHL_TRACKING,
        formId: "LRE AV Website Form",
        siteUrl: "https://videntaudiovisual.com/",
        notesKey: "calendar_notes",
        notesLabel: "Message",
        eventTypeKey: null,
        servicesKey: null,
      },
    },
  }),
};

/** "Add the starter forms" creates these LIVE with version 1 (admin action; never automatic). */
export const STARTER_FORMS: StarterForm[] = [V1, V2];
