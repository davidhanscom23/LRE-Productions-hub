/**
 * Inquiry Forms - this hub's staff-facing words and examples. HUB-SPECIFIC: each hub has its own
 * copy of this file (like server/adapter.ts, server/presets.ts and server/crm-map.ts); every other
 * inquiry-forms file is shared code, identical in both hubs. PURE: safe in client components,
 * server actions and vitest.
 *
 * Vident hub: a finished inquiry is a project at stage Inquiry on the Hub's HoneyBook board
 * (/honeybook; source "web_form", shown with a Website badge), and the record link
 * (adapter.staffRecordHref) opens that project. "Lead" is a role name in this hub (trainer), so
 * these words never call an inquiry a lead.
 */
import type { FieldRole } from "./types";

/** The CRM words of the submission drawer, the Submissions tab and the staff "Add to CRM" action. */
export const CRM_WORDS = {
  add: "Add to HoneyBook",
  adding: "Adding to HoneyBook...",
  added: "Added to the HoneyBook board as an Inquiry project.",
  /** Add when the project already existed (or another write just made it): nothing new was created. */
  already: "Already on the HoneyBook board. No second project was made.",
  /** Another write (the automatic one, or another admin) holds the project right now. */
  busy: "The Hub is adding this to HoneyBook right now. Check again in a minute.",
  /** The automatic write is still inside its retry window, so staff should wait. */
  stillCreating:
    "The Hub is still creating the HoneyBook project for this inquiry on its own. Check again in a few minutes.",
  /** Start of the error when a staff write fails ("Could not add this to HoneyBook: ..."). */
  failed: "Could not add this to HoneyBook",
  open: "Open the HoneyBook project",
  column: "HoneyBook",
  onCrm: "On the board",
  notYet: "Not yet",
  /** The CRM's name inside sentences ("Spam never goes to HoneyBook", "the HoneyBook card"). */
  name: "HoneyBook",
  /** inquiry_log kind labels (crm_record and crm_manual). */
  logRecord: "HoneyBook project",
  logManual: "Added to HoneyBook by staff",
  /** Mark as spam: the confirm question and the two status lines on a spam submission. */
  spamConfirm:
    "Mark this submission as spam? It is left out of the step-by-step funnel. A HoneyBook project that already exists stays on the board; delete it there if it is junk.",
  spamRecordStays: "Its HoneyBook project is still on the board; delete it there if it is junk.",
  spamNoRecord: "It is not on the HoneyBook board and it is left out of the step-by-step funnel.",
  /** The hub page that lists the CRM records (revalidated after a staff write). */
  pagePath: "/honeybook",
} as const;

/** Other hub-specific copy in the admin screens. */
export const HUB_COPY = {
  /** Inquiry Forms page header. */
  formsListDescription:
    "Multi-step website forms that check the date, then add each inquiry to the HoneyBook board as an Inquiry project.",
  /** Share tab, "Where to paste it": the site builder line and the test inquiry line. */
  shareSiteBuilder: "GoHighLevel site builder (videntproductions.com, videntaudiovisual.com)",
  shareTestInquiry:
    "Send a test inquiry: it shows up in Submissions and on the HoneyBook board in the Inquiry column.",
  /** Placeholders in the form settings. */
  exampleEmail: "name@videntproductions.com",
  exampleThankYouUrl: "https://videntproductions.com/thank-you",
  /** Eyebrow above the Inquiry Forms page titles: the nav group they sit in. */
  sectionEyebrow: "Quotes & Proposals",
} as const;

/** Builder words about where an answer lands (the role picker, field hints, budget policy). */
export const BUILDER_COPY = {
  roleHelpFallback: "A role tells the Hub what the answer means (where it lands on the HoneyBook project).",
  fullNameHint: "Their name for the HoneyBook project",
  firstQuestionHint:
    "Add the first question. Contact fields come with their role set, so answers land in the right place on the HoneyBook project.",
  budgetBelowHint: "The inquiry still comes in, with a lower score.",
} as const;

/**
 * What a role does, in the owner's words (shown under the role picker). Vident: a HoneyBook project
 * (project type, date, budget, location and the details text) plus the client's name, email and phone.
 * There is no guest count, inquiry source, message or company column, so those go into the details.
 */
export const ROLE_HELP: Record<FieldRole, string> = {
  name: "Names the HoneyBook project and a new client.",
  email: "Used to find or create the client and to reach them.",
  phone: "Saved on a new client and in the project details.",
  company: "Added to the project details.",
  event_date: "The date the availability step checks. Saved as the project date.",
  event_time: "Added to the project details.",
  event_location: "The place the location check measures. Saved as the project location.",
  guest_count: "Added to the project details.",
  event_type: "Saved as the project type.",
  services: "Added to the project details.",
  budget: "Scores the inquiry and is saved as the project budget.",
  contact_preference: "Tells the team how the person wants to be contacted.",
  referral_source: "Added to the project details.",
  notes: "Added to the project details.",
};
