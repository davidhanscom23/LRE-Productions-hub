import "server-only";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { KB_UPLOAD_MAX_BYTES } from "@/lib/kb/upload-constants";

export type KbExtractResult =
  | { ok: true; text: string; kind: "pdf" | "docx"; pageCount?: number }
  | { ok: false; error: string };

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function isPdf(file: File): boolean {
  const ext = extensionOf(file.name);
  return file.type === "application/pdf" || ext === ".pdf";
}

function isDocx(file: File): boolean {
  const ext = extensionOf(file.name);
  return (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  );
}

function cleanExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pdfTextToString(text: string | string[]): string {
  return typeof text === "string" ? text : text.join("\n\n");
}

/** Extract text from an already-loaded PDF or DOCX buffer (Drive downloads). */
export async function extractTextFromKnowledgeBuffer(
  buffer: Buffer,
  kind: "pdf" | "docx",
): Promise<KbExtractResult> {
  if (!buffer.length) {
    return { ok: false, error: "Empty file." };
  }
  if (buffer.length > KB_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: "That file is too large. Keep files under 10 MB.",
    };
  }

  try {
    if (kind === "pdf") {
      const pdfData = new Uint8Array(buffer);
      const result = await extractText(pdfData, { mergePages: true });
      const text = cleanExtractedText(pdfTextToString(result.text));
      if (!text) {
        return {
          ok: false,
          error:
            "Couldn’t find readable text in that PDF. Use a text PDF (not a scanned image).",
        };
      }
      return {
        ok: true,
        text,
        kind: "pdf",
        pageCount: result.totalPages,
      };
    }

    const result = await mammoth.extractRawText({ buffer });
    const text = cleanExtractedText(result.value ?? "");
    if (!text) {
      return {
        ok: false,
        error: "Couldn’t find readable text in that Word file.",
      };
    }
    return { ok: true, text, kind: "docx" };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Couldn’t read that file: ${error.message}`
          : "Couldn’t read that file.",
    };
  }
}

/** Pull plain text from an uploaded PDF or Word (.docx) file. */
export async function extractTextFromKnowledgeFile(
  file: File,
): Promise<KbExtractResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a PDF or Word (.docx) file to upload." };
  }
  if (file.size > KB_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: "That file is too large. Keep uploads under 10 MB.",
    };
  }

  // Legacy .doc is not supported (mammoth needs .docx).
  if (extensionOf(file.name) === ".doc") {
    return {
      ok: false,
      error:
        "Old .doc Word files aren’t supported. Save as .docx or PDF and try again.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (isPdf(file)) {
      return extractTextFromKnowledgeBuffer(buffer, "pdf");
    }

    if (isDocx(file)) {
      return extractTextFromKnowledgeBuffer(buffer, "docx");
    }

    return {
      ok: false,
      error: "Only PDF and Word (.docx) uploads are supported right now.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Couldn’t read that file: ${error.message}`
          : "Couldn’t read that file.",
    };
  }
}

export function titleFromUploadFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || "Uploaded document";
}
