/**
 * Inquiry Forms admin: shapes shared by the forms list, the server actions and the editor.
 * PURE module (types and constants only): safe in client components, server code and vitest.
 */

export const FORM_STATUSES = ["draft", "live", "paused", "archived"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export function isFormStatus(value: unknown): value is FormStatus {
  return typeof value === "string" && (FORM_STATUSES as readonly string[]).includes(value);
}

export interface FormStats {
  views: number;
  starts: number;
  completes: number;
}

/** One row of the forms list (return shape of listForms). */
export interface FormListRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  status: FormStatus;
  /** Version number of the published snapshot, null when never published. */
  publishedVersion: number | null;
  updatedAt: string;
  /** Last 30 days (America/New_York days, today included). */
  stats30d: FormStats;
  /** Newest completed or waitlisted submission, null when none. */
  lastSubmissionAt: string | null;
}

/** What the empty-state card shows about each starter form. */
export interface StarterFormSummary {
  slug: string;
  name: string;
  brandName: string;
  stepCount: number;
}

/**
 * The text every admin page shows when the Inquiry Forms migration has not been run yet. House rule (commit
 * 5358814): module pages never name migration files; Hub health carries that detail.
 */
export const NEEDS_MIGRATION_MESSAGE = "Inquiry Forms is not set up on this hub yet";
