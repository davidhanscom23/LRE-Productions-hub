/**
 * Column headers for the Vident Client Reviews Google Sheet.
 * Keep in sync with the marketing site /reviews CSV and sync-sheet parsers.
 */
export const REVIEWS_SHEET_HEADERS = [
  "Name",
  "Comment",
  "Rating",
  "Date",
  "Event Type",
  "Service(s)",
  "Staff Member(s)",
  "Show on site?",
  "Needs review?",
  "Event_ID",
] as const;

export const REVIEWS_SHEET_TITLE = "Vident Client Reviews";

/** app_settings key for the Hub-managed spreadsheet id (created in Drive). */
export const REVIEWS_SPREADSHEET_SETTING_KEY =
  "google_sheets_reviews_spreadsheet_id";
