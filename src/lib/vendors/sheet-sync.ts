import "server-only";

import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDriveConfig, isDriveCredentialsConfigured } from "@/lib/drive/client";
import {
  VENDORS_SHEET_HEADERS,
  VENDORS_SHEET_SETTING_KEY,
  VENDORS_SHEET_TITLE,
  type Vendor,
} from "@/lib/vendors/types";

function getSheetsAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!clientEmail || !privateKey) return null;
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

async function readSavedSpreadsheetId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", VENDORS_SHEET_SETTING_KEY)
    .maybeSingle();
  const value = data?.value?.trim() ?? "";
  return value || null;
}

async function saveSpreadsheetId(
  supabase: SupabaseClient,
  spreadsheetId: string,
): Promise<void> {
  await supabase.from("app_settings").upsert(
    {
      key: VENDORS_SHEET_SETTING_KEY,
      value: spreadsheetId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

function vendorToRow(vendor: Vendor): string[] {
  return [
    vendor.category,
    vendor.company_name,
    vendor.contact_name,
    vendor.phone,
    vendor.email,
    vendor.website,
    vendor.preferred ? "yes" : "no",
    (vendor.departments ?? []).join(", "),
    vendor.notes,
    vendor.id,
    vendor.updated_at,
  ];
}

/**
 * Ensure a Vendors Google Sheet exists under the Hub Drive root, then rewrite
 * all rows from Hub (Hub is source of truth).
 */
export async function syncVendorsToSheet(
  supabase: SupabaseClient,
  vendors: Vendor[],
): Promise<{ ok: boolean; spreadsheetId: string | null; error: string | null }> {
  if (!isDriveCredentialsConfigured()) {
    return {
      ok: false,
      spreadsheetId: null,
      error: "Google Drive credentials are not configured.",
    };
  }

  const auth = getSheetsAuth();
  if (!auth) {
    return {
      ok: false,
      spreadsheetId: null,
      error: "Google service account is not configured.",
    };
  }

  const driveCfg = await getDriveConfig();
  if (!driveCfg) {
    return {
      ok: false,
      spreadsheetId: null,
      error: "Google Drive root folder is not configured.",
    };
  }

  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  let spreadsheetId = await readSavedSpreadsheetId(supabase);

  try {
    if (!spreadsheetId) {
      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: VENDORS_SHEET_TITLE },
          sheets: [{ properties: { title: "Vendors" } }],
        },
      });
      spreadsheetId = created.data.spreadsheetId ?? null;
      if (!spreadsheetId) {
        return {
          ok: false,
          spreadsheetId: null,
          error: "Google Sheets did not return a spreadsheet id.",
        };
      }

      // Move into Hub Drive root.
      const file = await drive.files.get({
        fileId: spreadsheetId,
        fields: "parents",
        supportsAllDrives: true,
      });
      const parents = file.data.parents ?? [];
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: driveCfg.rootFolderId,
        removeParents: parents.join(","),
        supportsAllDrives: true,
        fields: "id",
      });

      await saveSpreadsheetId(supabase, spreadsheetId);
    }

    const values = [
      [...VENDORS_SHEET_HEADERS],
      ...vendors.map(vendorToRow),
    ];

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "Vendors",
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Vendors!A1",
      valueInputOption: "RAW",
      requestBody: { values },
    });

    return { ok: true, spreadsheetId, error: null };
  } catch (err) {
    return {
      ok: false,
      spreadsheetId,
      error:
        err instanceof Error
          ? err.message
          : "Failed to sync vendors to Google Sheets.",
    };
  }
}
