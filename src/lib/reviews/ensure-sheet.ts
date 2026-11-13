import "server-only";

import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDriveConfig,
  isDriveCredentialsConfigured,
} from "@/lib/drive/client";
import {
  REVIEWS_SHEET_HEADERS,
  REVIEWS_SHEET_TITLE,
  REVIEWS_SPREADSHEET_SETTING_KEY,
} from "@/lib/reviews/sheet-headers";
import { parseSpreadsheetId } from "@/lib/reviews/spreadsheet-id";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export type EnsureReviewsSheetResult = {
  ok: boolean;
  created: boolean;
  spreadsheetId: string | null;
  webViewLink: string | null;
  folderId: string | null;
  error: string | null;
};

function googleErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Failed to create the Client Reviews spreadsheet.";
  }
  const anyErr = err as {
    message?: string;
    errors?: Array<{ message?: string; reason?: string }>;
    response?: { data?: { error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> } } };
  };
  const reason =
    anyErr.errors?.[0]?.reason ||
    anyErr.response?.data?.error?.errors?.[0]?.reason ||
    "";
  const message =
    anyErr.response?.data?.error?.message ||
    anyErr.errors?.[0]?.message ||
    anyErr.message ||
    "Failed to create the Client Reviews spreadsheet.";

  const sa =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    "the Hub Google service account";

  if (
    reason === "storageQuotaExceeded" ||
    /storage quota has been exceeded/i.test(message)
  ) {
    return (
      `Google Drive blocked creating a new file (service-account storage quota). ` +
      `Create a blank Google Sheet yourself in the LRE Drive folder, put the header row on row 1, ` +
      `share it with ${sa} as Editor, then paste the sheet URL below and click Link spreadsheet.`
    );
  }

  return message;
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

async function readSavedSpreadsheetId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", REVIEWS_SPREADSHEET_SETTING_KEY)
    .maybeSingle();
  const value = data?.value?.trim() ?? "";
  return value || null;
}

async function saveSpreadsheetId(
  supabase: SupabaseClient,
  spreadsheetId: string,
): Promise<string | null> {
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: REVIEWS_SPREADSHEET_SETTING_KEY,
      value: spreadsheetId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  return error?.message ?? null;
}

async function findExistingSpreadsheetInFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  title: string,
): Promise<{ id: string; webViewLink: string | null } | null> {
  const escaped = title.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id, webViewLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const file = res.data.files?.[0];
  if (!file?.id) return null;
  return { id: file.id, webViewLink: file.webViewLink ?? null };
}

async function writeHeaderRow(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1:J1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[...REVIEWS_SHEET_HEADERS]],
    },
  });
}

/**
 * Create (or reuse) a blank LRE Client Reviews spreadsheet in the Hub Drive
 * root folder, write the standard header row, and persist the spreadsheet id.
 */
export async function ensureReviewsSpreadsheet(options?: {
  writeClient?: SupabaseClient;
}): Promise<EnsureReviewsSheetResult> {
  if (!isDriveCredentialsConfigured()) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error:
        "Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY).",
    };
  }

  const driveConfig = await getDriveConfig();
  if (!driveConfig) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error:
        "Google Drive root folder could not be resolved. Set GOOGLE_DRIVE_ROOT_FOLDER_ID or save a folder on /drive.",
    };
  }

  const auth = getGoogleSaAuth([
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  if (!auth) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error: "Google service account credentials are incomplete.",
    };
  }

  const canUseService = isServiceRoleConfigured();
  if (!canUseService && !options?.writeClient) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not configured, and no admin write client was provided.",
    };
  }

  const supabase =
    options?.writeClient && !canUseService
      ? options.writeClient
      : createServiceClient();

  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });
  const folderId = driveConfig.rootFolderId;

  try {
    const envId =
      process.env.GOOGLE_SHEETS_REVIEWS_SPREADSHEET_ID?.trim() || null;
    const savedId = (await readSavedSpreadsheetId(supabase)) || envId;

    if (savedId) {
      try {
        const meta = await drive.files.get({
          fileId: savedId,
          fields: "id, name, webViewLink, trashed",
          supportsAllDrives: true,
        });
        if (meta.data.id && !meta.data.trashed) {
          await writeHeaderRow(sheets, meta.data.id);
          if (!envId || envId !== meta.data.id) {
            const saveError = await saveSpreadsheetId(supabase, meta.data.id);
            if (saveError) {
              return {
                ok: false,
                created: false,
                spreadsheetId: meta.data.id,
                webViewLink: meta.data.webViewLink ?? null,
                folderId,
                error: saveError,
              };
            }
          }
          return {
            ok: true,
            created: false,
            spreadsheetId: meta.data.id,
            webViewLink: meta.data.webViewLink ?? null,
            folderId,
            error: null,
          };
        }
      } catch {
        // Saved/env id missing or inaccessible — create or find by name below.
      }
    }

    const existing = await findExistingSpreadsheetInFolder(
      drive,
      folderId,
      REVIEWS_SHEET_TITLE,
    );
    if (existing) {
      await writeHeaderRow(sheets, existing.id);
      const saveError = await saveSpreadsheetId(supabase, existing.id);
      if (saveError) {
        return {
          ok: false,
          created: false,
          spreadsheetId: existing.id,
          webViewLink: existing.webViewLink,
          folderId,
          error: saveError,
        };
      }
      return {
        ok: true,
        created: false,
        spreadsheetId: existing.id,
        webViewLink: existing.webViewLink,
        folderId,
        error: null,
      };
    }

    const created = await drive.files.create({
      requestBody: {
        name: REVIEWS_SHEET_TITLE,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [folderId],
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });

    const spreadsheetId = created.data.id;
    if (!spreadsheetId) {
      return {
        ok: false,
        created: false,
        spreadsheetId: null,
        webViewLink: null,
        folderId,
        error: "Drive created a spreadsheet without an id.",
      };
    }

    await writeHeaderRow(sheets, spreadsheetId);

    const saveError = await saveSpreadsheetId(supabase, spreadsheetId);
    if (saveError) {
      return {
        ok: false,
        created: true,
        spreadsheetId,
        webViewLink: created.data.webViewLink ?? null,
        folderId,
        error: saveError,
      };
    }

    return {
      ok: true,
      created: true,
      spreadsheetId,
      webViewLink: created.data.webViewLink ?? null,
      folderId,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId,
      error: googleErrorMessage(err),
    };
  }
}

/**
 * Link an existing spreadsheet (you created in Drive) and write the header row.
 * Use this when the service account cannot create files due to storage quota.
 */
export async function linkReviewsSpreadsheet(
  input: string,
  options?: { writeClient?: SupabaseClient },
): Promise<EnsureReviewsSheetResult> {
  const spreadsheetId = parseSpreadsheetId(input);
  if (!spreadsheetId) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error:
        "Paste a Google Sheets URL (docs.google.com/spreadsheets/d/…) or the spreadsheet id.",
    };
  }

  if (spreadsheetId === "1qDlqSrVgxeTa-4TouuWFnmiBoUZa4NKQgujJson33Is") {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error:
        "That spreadsheet is a blocked legacy reviews sheet. Link a LRE Client Reviews sheet instead.",
    };
  }

  if (!isDriveCredentialsConfigured()) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error:
        "Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY).",
    };
  }

  const auth = getGoogleSaAuth([
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  if (!auth) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error: "Google service account credentials are incomplete.",
    };
  }

  const canUseService = isServiceRoleConfigured();
  if (!canUseService && !options?.writeClient) {
    return {
      ok: false,
      created: false,
      spreadsheetId: null,
      webViewLink: null,
      folderId: null,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not configured, and no admin write client was provided.",
    };
  }

  const supabase =
    options?.writeClient && !canUseService
      ? options.writeClient
      : createServiceClient();

  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });
  const driveConfig = await getDriveConfig();
  const folderId = driveConfig?.rootFolderId ?? null;
  const sa =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    "the Hub Google service account";

  try {
    const meta = await drive.files.get({
      fileId: spreadsheetId,
      fields: "id, name, webViewLink, mimeType, trashed",
      supportsAllDrives: true,
    });
    if (!meta.data.id || meta.data.trashed) {
      return {
        ok: false,
        created: false,
        spreadsheetId: null,
        webViewLink: null,
        folderId,
        error: "That spreadsheet was not found or is in the trash.",
      };
    }
    if (meta.data.mimeType !== "application/vnd.google-apps.spreadsheet") {
      return {
        ok: false,
        created: false,
        spreadsheetId: null,
        webViewLink: null,
        folderId,
        error: "That Drive file is not a Google Sheet.",
      };
    }

    await writeHeaderRow(sheets, spreadsheetId);

    const saveError = await saveSpreadsheetId(supabase, spreadsheetId);
    if (saveError) {
      return {
        ok: false,
        created: false,
        spreadsheetId,
        webViewLink: meta.data.webViewLink ?? null,
        folderId,
        error: saveError,
      };
    }

    return {
      ok: true,
      created: false,
      spreadsheetId,
      webViewLink: meta.data.webViewLink ?? null,
      folderId,
      error: null,
    };
  } catch (err) {
    const message = googleErrorMessage(err);
    if (/not found|404|insufficient|permission|forbidden/i.test(message)) {
      return {
        ok: false,
        created: false,
        spreadsheetId,
        webViewLink: null,
        folderId,
        error: `The Hub cannot open that sheet. Share it with ${sa} as Editor, then try again.`,
      };
    }
    return {
      ok: false,
      created: false,
      spreadsheetId,
      webViewLink: null,
      folderId,
      error: message,
    };
  }
}

/** Resolve spreadsheet id from env, then Hub app_settings. */
export async function resolveReviewsSpreadsheetId(
  supabase?: SupabaseClient,
): Promise<string | null> {
  const fromEnv =
    process.env.GOOGLE_SHEETS_REVIEWS_SPREADSHEET_ID?.trim() || null;
  // Blocked legacy workbook id — never use it for LRE.
  if (fromEnv === "1qDlqSrVgxeTa-4TouuWFnmiBoUZa4NKQgujJson33Is") {
    console.warn(
      "[reviews] Ignoring GOOGLE_SHEETS_REVIEWS_SPREADSHEET_ID — it points at a blocked legacy sheet.",
    );
  } else if (fromEnv) {
    return fromEnv;
  }

  try {
    const client =
      supabase ??
      (isServiceRoleConfigured() ? createServiceClient() : null);
    if (!client) return null;
    return await readSavedSpreadsheetId(client);
  } catch {
    return null;
  }
}
