import "server-only";

import { getGeminiCredentials } from "@/lib/gemini/credentials";
import type { StudioImageAspectRatio } from "@/lib/social/image-gen-models";

export const NANO_BANANA_PRO_GEMINI_MODEL = "gemini-3-pro-image-preview";

const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_PRO_GEMINI_MODEL}:generateContent`;

export type GeminiGeneratedImage = {
  bytes: Buffer;
  contentType: string;
  extension: string;
};

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return response.statusText || `HTTP ${response.status}`;
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string; status?: string };
      message?: string;
    };
    if (json.error?.message) return json.error.message;
    if (json.message) return json.message;
  } catch {
    // fall through
  }
  return text.slice(0, 400);
}

function extensionForMime(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "png";
}

export type NanoBananaReferenceImage = {
  bytes: Buffer;
  mimeType: string;
};

/**
 * Generate a still with Gemini Nano Banana Pro (gemini-3-pro-image-preview).
 * Optional reference image (e.g. venue room photo) is passed as inline data.
 * Returns decoded image bytes (typically PNG).
 */
export async function generateNanoBananaProImage(input: {
  prompt: string;
  aspectRatio: StudioImageAspectRatio;
  imageSize?: "1K" | "2K" | "4K";
  referenceImage?: NanoBananaReferenceImage;
}): Promise<GeminiGeneratedImage> {
  const creds = getGeminiCredentials();
  if (!creds) {
    throw new Error(
      "Nano Banana Pro not configured. Set GEMINI_API_KEY in Vercel / .env.local.",
    );
  }

  const prompt = input.prompt.trim();
  if (prompt.length < 3) throw new Error("Prompt is too short.");
  if (prompt.length > 4000) throw new Error("Prompt is too long (max 4000).");

  const requestParts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [];
  if (input.referenceImage && input.referenceImage.bytes.length > 0) {
    const mime =
      input.referenceImage.mimeType &&
      input.referenceImage.mimeType.includes("/")
        ? input.referenceImage.mimeType
        : "image/jpeg";
    requestParts.push({
      inline_data: {
        mime_type: mime,
        data: input.referenceImage.bytes.toString("base64"),
      },
    });
  }
  requestParts.push({ text: prompt });

  const response = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: requestParts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: input.aspectRatio,
          imageSize: input.imageSize ?? "2K",
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini image generation failed: ${await readError(response)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
          inline_data?: { mime_type?: string; data?: string };
        }>;
      };
    }>;
  };

  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of responseParts) {
    const inline = part.inlineData ?? part.inline_data;
    const b64 = inline?.data;
    const mimeType =
      inline && "mimeType" in inline
        ? inline.mimeType
        : inline && "mime_type" in inline
          ? inline.mime_type
          : undefined;
    if (typeof b64 === "string" && b64.length > 0) {
      const contentType =
        typeof mimeType === "string" && mimeType.includes("/")
          ? mimeType
          : "image/png";
      const bytes = Buffer.from(b64, "base64");
      if (bytes.length < 32) {
        throw new Error("Gemini returned an empty image.");
      }
      return {
        bytes,
        contentType,
        extension: extensionForMime(contentType),
      };
    }
  }

  throw new Error("Gemini returned no image data in the response.");
}
