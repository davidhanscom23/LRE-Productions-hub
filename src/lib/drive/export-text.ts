import "server-only";

import { extractTextFromKnowledgeBuffer } from "@/lib/kb/extract-document";
import { KB_UPLOAD_MAX_BYTES } from "@/lib/kb/upload-constants";
import type { drive_v3 } from "googleapis";

const DOC_MIME = "application/vnd.google-apps.document";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const DRIVE_KB_INDEXABLE_MIMES = [
  DOC_MIME,
  SHEET_MIME,
  PDF_MIME,
  DOCX_MIME,
] as const;

export type DriveExportKind = "gdoc" | "gsheet" | "pdf" | "docx";

export function driveKbKindForMime(mimeType: string): DriveExportKind | null {
  if (mimeType === DOC_MIME) return "gdoc";
  if (mimeType === SHEET_MIME) return "gsheet";
  if (mimeType === PDF_MIME) return "pdf";
  if (mimeType === DOCX_MIME) return "docx";
  return null;
}

function cleanText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function downloadBinary(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  const data = res.data as ArrayBuffer;
  return Buffer.from(data);
}

/**
 * Export / download a Drive file as plain text for Ask the Hub indexing.
 * Caps binary downloads at the same 10 MB limit as KB uploads.
 */
export async function exportDriveFileAsText(
  drive: drive_v3.Drive,
  fileId: string,
  mimeType: string,
): Promise<{ ok: true; text: string; kind: DriveExportKind } | { ok: false; error: string }> {
  const kind = driveKbKindForMime(mimeType);
  if (!kind) {
    return { ok: false, error: `Unsupported MIME type: ${mimeType}` };
  }

  try {
    if (kind === "gdoc") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" },
      );
      const text = cleanText(String(res.data ?? ""));
      if (!text) return { ok: false, error: "Google Doc exported empty text." };
      return { ok: true, text: text.slice(0, 200_000), kind };
    }

    if (kind === "gsheet") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/csv" },
        { responseType: "text" },
      );
      const text = cleanText(String(res.data ?? ""));
      if (!text) return { ok: false, error: "Spreadsheet exported empty CSV." };
      // Cap noisy sheets.
      return { ok: true, text: text.slice(0, 150_000), kind };
    }

    const buffer = await downloadBinary(drive, fileId);
    if (buffer.length > KB_UPLOAD_MAX_BYTES) {
      return { ok: false, error: "File exceeds 10 MB index limit." };
    }
    const extracted = await extractTextFromKnowledgeBuffer(
      buffer,
      kind === "pdf" ? "pdf" : "docx",
    );
    if (!extracted.ok) return { ok: false, error: extracted.error };
    return {
      ok: true,
      text: extracted.text.slice(0, 200_000),
      kind,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not export Drive file.",
    };
  }
}
