import "server-only";

import { createHash } from "crypto";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bridgeReviewsToPackets } from "@/lib/reviews/bridge-packets";
import { parseCsv } from "@/lib/reviews/csv";
import { refreshAllReviewCredits } from "@/lib/reviews/credited-profiles";
import { resolveReviewsSpreadsheetId } from "@/lib/reviews/ensure-sheet";
import {
  calendarUidFromEventId,
  normalizeDjepEventId,
  type EventExternalReviewSyncResult,
} from "@/lib/types/event-reviews";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

type SheetRow = {
  sheetRow: number;
  fingerprint: string;
  reviewerName: string;
  comment: string;
  rating: number | null;
  reviewDate: string | null;
  eventType: string;
  services: string;
  staffMembers: string;
  showOnSite: boolean | null;
  needsReview: boolean | null;
  eventId: string | null;
  calendarUid: string | null;
};

function emptyResult(
  partial: Partial<EventExternalReviewSyncResult> = {},
): EventExternalReviewSyncResult {
  return {
    ok: false,
    ran: false,
    rowsRead: 0,
    upserted: 0,
    matched: 0,
    unmatched: 0,
    withEventId: 0,
    missingEventId: 0,
    packetsCreated: 0,
    calendarFeedsScanned: 0,
    calendarEventsLoaded: 0,
    calendarEventIdsFound: 0,
    reviewIdsOnCalendar: 0,
    packetsFromReviewsOnly: 0,
    skippedNoStaff: 0,
    skippedNoComment: 0,
    pruned: 0,
    source: null,
    error: null,
    ...partial,
  };
}

function getGoogleSaAuth(scopes: string[]) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!clientEmail || !privateKey) return null;
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
  });
}

/** Published CSV URL for Vident reviews only — no legacy sheet fallback. */
const BLOCKED_LEGACY_REVIEW_HOST_MARKERS = [
  // Legacy published CSV / sheet ids from older Hub builds — never use for Vident.
  "2PACX-1vSZ5U9Viy3cFH0fvaraVKCVys2XPaGuKixi4VVGO_0PrYzKtWYyyidCenW1wwUl0L7oorZJJcC4zf5n",
  "1qDlqSrVgxeTa-4TouuWFnmiBoUZa4NKQgujJson33Is",
];

function isBlockedLegacyReviewsUrl(url: string): boolean {
  return BLOCKED_LEGACY_REVIEW_HOST_MARKERS.some((marker) => url.includes(marker));
}

export function getReviewsPublishedCsvUrl(): string | null {
  const url = process.env.GOOGLE_SHEETS_REVIEWS_CSV_URL?.trim() || "";
  if (!url) return null;
  if (isBlockedLegacyReviewsUrl(url)) {
    console.warn(
      "[reviews] Ignoring GOOGLE_SHEETS_REVIEWS_CSV_URL — it points at a blocked legacy sheet.",
    );
    return null;
  }
  return url;
}

function hasSheetsApiCredentials(): boolean {
  return Boolean(
    getGoogleSaAuth(["https://www.googleapis.com/auth/spreadsheets.readonly"]),
  );
}

/**
 * Sync check for Hub Health (env only). Prefer `isReviewsSheetConfiguredAsync`
 * when app_settings may hold the spreadsheet id.
 */
export function isReviewsSheetConfigured(): boolean {
  if (getReviewsPublishedCsvUrl()) return true;
  const sheetId =
    process.env.GOOGLE_SHEETS_REVIEWS_SPREADSHEET_ID?.trim() || "";
  return Boolean(sheetId && hasSheetsApiCredentials());
}

/** True when CSV URL or (service account + spreadsheet id from env/settings). */
export async function isReviewsSheetConfiguredAsync(
  supabase?: SupabaseClient,
): Promise<boolean> {
  if (getReviewsPublishedCsvUrl()) return true;
  if (!hasSheetsApiCredentials()) return false;
  const sheetId = await resolveReviewsSpreadsheetId(supabase);
  return Boolean(sheetId);
}
function cell(row: string[], index: number | undefined): string {
  if (index == null) return "";
  return String(row[index] ?? "").trim();
}

function parseYesNo(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (["yes", "y", "true", "1"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return null;
}

function parseRating(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function headerIndex(headers: string[], candidates: string[]): number | undefined {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const i = normalized.indexOf(candidate.toLowerCase());
    if (i >= 0) return i;
  }
  return undefined;
}

function fingerprintFor(row: {
  reviewerName: string;
  reviewDate: string | null;
  comment: string;
}): string {
  const basis = [
    row.reviewerName.trim().toLowerCase(),
    row.reviewDate ?? "",
    row.comment.trim().toLowerCase(),
  ].join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 40);
}

function rowsFromMatrix(values: string[][]): SheetRow[] {
  if (values.length < 2) return [];

  const headers = (values[0] ?? []).map((h) => String(h ?? ""));
  const idx = {
    name: headerIndex(headers, ["Name", "Reviewer", "Client"]),
    comment: headerIndex(headers, ["Comment", "Review", "Review text"]),
    rating: headerIndex(headers, ["Rating"]),
    date: headerIndex(headers, ["Date", "Review date"]),
    eventType: headerIndex(headers, ["Event Type", "Event type"]),
    services: headerIndex(headers, ["Service(s)", "Services", "Service"]),
    staff: headerIndex(headers, [
      "Staff Member(s)",
      "Staff Members",
      "Staff",
    ]),
    showOnSite: headerIndex(headers, ["Show on site?", "Show on site"]),
    needsReview: headerIndex(headers, ["Needs review?", "Needs review"]),
    eventId: headerIndex(headers, [
      "Event_ID",
      "Event ID",
      "EventId",
      "EVENTID",
    ]),
  };

  if (idx.comment == null) {
    throw new Error(
      'Sheet is missing a "Comment" column (or Review / Review text).',
    );
  }

  const out: SheetRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = (values[i] ?? []).map((c) => String(c ?? ""));
    const comment = cell(row, idx.comment);
    if (!comment) continue;

    const reviewerName = cell(row, idx.name);
    const reviewDate = parseDate(cell(row, idx.date));
    const eventId = normalizeDjepEventId(cell(row, idx.eventId));

    out.push({
      sheetRow: i + 1,
      fingerprint: fingerprintFor({
        reviewerName,
        reviewDate,
        comment,
      }),
      reviewerName,
      comment,
      rating: parseRating(cell(row, idx.rating)),
      reviewDate,
      eventType: cell(row, idx.eventType),
      services: cell(row, idx.services),
      staffMembers: cell(row, idx.staff),
      showOnSite: parseYesNo(cell(row, idx.showOnSite)),
      needsReview: parseYesNo(cell(row, idx.needsReview)),
      eventId,
      calendarUid: eventId ? calendarUidFromEventId(eventId) : null,
    });
  }

  return out;
}

async function fetchPublishedCsvRows(url: string): Promise<SheetRow[]> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "text/csv,*/*" },
  });
  if (!res.ok) {
    throw new Error(
      `Published reviews CSV returned HTTP ${res.status}. Check GOOGLE_SHEETS_REVIEWS_CSV_URL.`,
    );
  }
  const text = await res.text();
  if (!text.trim()) {
    // Header-only / blank publish is valid (Vident sheet starts empty).
    return [];
  }
  return rowsFromMatrix(parseCsv(text));
}

async function fetchSheetsApiRows(
  spreadsheetId: string,
): Promise<SheetRow[]> {
  const auth = getGoogleSaAuth([
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);
  if (!auth) {
    throw new Error(
      "Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY).",
    );
  }

  const range = process.env.GOOGLE_SHEETS_REVIEWS_RANGE?.trim() || "A:J";

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS",
  });

  const values = (res.data.values ?? []).map((row) =>
    (row ?? []).map((c) => String(c ?? "")),
  );
  return rowsFromMatrix(values);
}

async function loadReviewRows(supabase?: SupabaseClient): Promise<{
  rows: SheetRow[];
  source: "published_csv" | "sheets_api";
}> {
  const csvUrl = getReviewsPublishedCsvUrl();
  if (csvUrl) {
    try {
      // Prefer published CSV when configured (same source as the marketing site).
      // A successful header-only fetch is valid — do not fall through to Sheets API.
      const rows = await fetchPublishedCsvRows(csvUrl);
      return { rows, source: "published_csv" };
    } catch (err) {
      console.warn(
        "[reviews] published CSV failed, trying Sheets API",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const spreadsheetId = await resolveReviewsSpreadsheetId(supabase);
  if (!spreadsheetId) {
    throw new Error(
      "Reviews sync is not configured. Set GOOGLE_SHEETS_REVIEWS_CSV_URL, or create the Vident sheet from Client Reviews (Drive + service account).",
    );
  }

  const rows = await fetchSheetsApiRows(spreadsheetId);
  return { rows, source: "sheets_api" };
}
function normalizePersonKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Pull testimonials (published CSV preferred) and upsert into
 * event_external_reviews. Then create missing packets for Event_IDs still on
 * the company calendar and recount matches. Rows no longer in the sheet are
 * pruned so a prior company’s reviews cannot linger after unlink.
 */
export async function syncExternalReviewsFromSheet(options?: {
  /** Optional write client (admin session) when service role is unavailable. */
  writeClient?: SupabaseClient;
}): Promise<EventExternalReviewSyncResult> {
  const canUseService = isServiceRoleConfigured();
  if (!canUseService && !options?.writeClient) {
    return emptyResult({
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not configured (needed to write reviews), and no admin write client was provided.",
    });
  }

  const supabase =
    options?.writeClient && !canUseService
      ? options.writeClient
      : createServiceClient();

  if (!(await isReviewsSheetConfiguredAsync(supabase))) {
    return emptyResult({
      error:
        "Reviews sync is not configured. Set GOOGLE_SHEETS_REVIEWS_CSV_URL or create the Vident Client Reviews sheet from Client Reviews (requires Drive + service account).",
    });
  }

  let rows: SheetRow[];
  let source: "published_csv" | "sheets_api";
  try {
    ({ rows, source } = await loadReviewRows(supabase));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read reviews sheet.";
    return emptyResult({ ran: true, error: message });
  }

  const now = new Date().toISOString();

  const { data: packetRows, error: packetError } = await supabase
    .from("event_packets")
    .select("id, calendar_uid, client_name, event_date")
    .not("calendar_uid", "is", null);

  if (packetError) {
    return emptyResult({ ran: true, source, error: packetError.message });
  }

  const packetsByEventId = new Map<string, string[]>();
  const packetsByClientDate = new Map<string, string[]>();
  for (const packet of packetRows ?? []) {
    const eventId = normalizeDjepEventId(
      packet.calendar_uid ? String(packet.calendar_uid) : null,
    );
    if (eventId) {
      const list = packetsByEventId.get(eventId) ?? [];
      list.push(String(packet.id));
      packetsByEventId.set(eventId, list);
    }

    const client = normalizePersonKey(String(packet.client_name ?? ""));
    const date = String(packet.event_date ?? "").slice(0, 10);
    if (client && date) {
      const key = `${date}|${client}`;
      const list = packetsByClientDate.get(key) ?? [];
      list.push(String(packet.id));
      packetsByClientDate.set(key, list);
    }
  }

  let upserted = 0;
  let withEventId = 0;
  let missingEventId = 0;
  const keepFingerprints = new Set<string>();

  for (const row of rows) {
    keepFingerprints.add(row.fingerprint);
    if (row.eventId) withEventId += 1;
    else missingEventId += 1;

    let matchCount = row.eventId
      ? (packetsByEventId.get(row.eventId)?.length ?? 0)
      : 0;

    // Fallback: same calendar date + client/reviewer name (helps older packets
    // whose calendar_uid isn't EVENTID:{n}).
    if (matchCount === 0 && row.reviewDate && row.reviewerName.trim()) {
      const key = `${row.reviewDate}|${normalizePersonKey(row.reviewerName)}`;
      matchCount = packetsByClientDate.get(key)?.length ?? 0;
    }

    const { error } = await supabase.from("event_external_reviews").upsert(
      {
        sheet_fingerprint: row.fingerprint,
        sheet_row: row.sheetRow,
        event_id: row.eventId,
        calendar_uid: row.calendarUid,
        reviewer_name: row.reviewerName,
        comment: row.comment,
        rating: row.rating,
        review_date: row.reviewDate,
        event_type: row.eventType,
        services: row.services,
        staff_members: row.staffMembers,
        show_on_site: row.showOnSite,
        needs_review: row.needsReview,
        source: "google_sheet",
        matched_packet_count: matchCount,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "sheet_fingerprint" },
    );

    if (error) {
      return emptyResult({
        ok: false,
        ran: true,
        rowsRead: rows.length,
        upserted,
        withEventId,
        missingEventId,
        source,
        error: error.message,
      });
    }
    upserted += 1;
  }

  // Drop rows that are no longer in the Vident sheet.
  let pruned = 0;
  const { data: existingReviews, error: existingError } = await supabase
    .from("event_external_reviews")
    .select("id, sheet_fingerprint")
    .eq("source", "google_sheet");
  if (existingError) {
    return emptyResult({
      ok: false,
      ran: true,
      rowsRead: rows.length,
      upserted,
      withEventId,
      missingEventId,
      source,
      error: existingError.message,
    });
  }
  const orphanIds = (existingReviews ?? [])
    .filter((r) => !keepFingerprints.has(String(r.sheet_fingerprint)))
    .map((r) => String(r.id));
  if (orphanIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("event_external_reviews")
      .delete()
      .in("id", orphanIds);
    if (deleteError) {
      return emptyResult({
        ok: false,
        ran: true,
        rowsRead: rows.length,
        upserted,
        withEventId,
        missingEventId,
        source,
        error: deleteError.message,
      });
    }
    pruned = orphanIds.length;
  }

  // Create packets for review Event_IDs (calendar when present; else review row
  // for the last 24 months). Uses sheet Staff Member(s) when ICS omits assignee.
  const bridge = await bridgeReviewsToPackets(
    supabase,
    rows.map((row) => ({
      eventId: row.eventId,
      calendarUid: row.calendarUid,
      reviewerName: row.reviewerName,
      reviewDate: row.reviewDate,
      eventType: row.eventType,
      staffMembers: row.staffMembers,
    })),
  );
  const packetsCreated = bridge.packetsCreated;

  // Recount matches after bridge.
  const { data: packetsAfter } = await supabase
    .from("event_packets")
    .select("id, calendar_uid")
    .not("calendar_uid", "is", null);

  const afterByEventId = new Map<string, number>();
  for (const packet of packetsAfter ?? []) {
    const eventId = normalizeDjepEventId(
      packet.calendar_uid ? String(packet.calendar_uid) : null,
    );
    if (!eventId) continue;
    afterByEventId.set(eventId, (afterByEventId.get(eventId) ?? 0) + 1);
  }

  let matched = 0;
  let unmatched = 0;
  for (const row of rows) {
    const count = row.eventId ? (afterByEventId.get(row.eventId) ?? 0) : 0;
    if (row.eventId && count > 0) {
      matched += 1;
      await supabase
        .from("event_external_reviews")
        .update({ matched_packet_count: count, updated_at: now })
        .eq("sheet_fingerprint", row.fingerprint);
    } else {
      unmatched += 1;
    }
  }

  // Persist credited Hub profile IDs for RLS (staff see only their reviews).
  await refreshAllReviewCredits(supabase);

  return {
    ok: true,
    ran: true,
    rowsRead: rows.length,
    upserted,
    matched,
    unmatched,
    withEventId,
    missingEventId,
    packetsCreated,
    calendarFeedsScanned: bridge.calendarFeedsScanned,
    calendarEventsLoaded: bridge.calendarEventsLoaded,
    calendarEventIdsFound: bridge.calendarEventIdsFound,
    reviewIdsOnCalendar: bridge.reviewIdsOnCalendar,
    packetsFromReviewsOnly: bridge.packetsFromReviewsOnly,
    skippedNoStaff: bridge.skippedNoStaff,
    skippedNoComment: 0,
    pruned,
    source,
    error: null,
  };
}
