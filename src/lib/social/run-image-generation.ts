import "server-only";

import { generateNanoBananaProImage } from "@/lib/gemini/nano-banana";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import { submitHiggsfieldImage } from "@/lib/higgsfield/client";
import { isHiggsfieldConfigured } from "@/lib/higgsfield/credentials";
import type { HiggsfieldImageModelId } from "@/lib/higgsfield/models";
import {
  DEFAULT_HIGGSFIELD_FALLBACK_MODEL,
  getStudioImageModel,
  resolveStudioImageModelId,
  type StudioImageAspectRatio,
  type StudioImageModelId,
} from "@/lib/social/image-gen-models";

export type GeminiImageSize = "1K" | "2K" | "4K";

export type StudioGenerationResult =
  | {
      error: string;
      provider?: undefined;
    }
  | {
      error: null;
      provider: "gemini";
      modelId: StudioImageModelId;
      aspectRatio: StudioImageAspectRatio;
      imageSize: GeminiImageSize;
      bytes: Buffer;
      contentType: string;
      extension: string;
      notice?: string;
    }
  | {
      error: null;
      provider: "higgsfield";
      modelId: StudioImageModelId;
      aspectRatio: StudioImageAspectRatio;
      requestId: string;
      notice?: string;
    };

function resolveAspectRatio(
  modelId: StudioImageModelId,
  requested?: string,
): StudioImageAspectRatio {
  const model = getStudioImageModel(modelId);
  if (!model) return "4:5";
  if (
    requested &&
    model.aspectRatios.includes(requested as StudioImageAspectRatio)
  ) {
    return requested as StudioImageAspectRatio;
  }
  return model.defaultAspectRatio;
}

function resolveImageSize(requested?: string): GeminiImageSize {
  if (requested === "1K" || requested === "2K" || requested === "4K") {
    return requested;
  }
  return "2K";
}

/**
 * Shared Gemini / Higgsfield generation used by Image Studio (and available
 * for other admin surfaces). Does not write storage or packet media.
 */
export async function runStudioImageGeneration(input: {
  prompt: string;
  modelId?: string;
  aspectRatio?: string;
  imageSize?: string;
}): Promise<StudioGenerationResult> {
  const prompt = input.prompt.trim();
  if (prompt.length < 3) {
    return { error: "Enter a prompt (at least a few words)." };
  }
  if (prompt.length > 4000) {
    return { error: "Prompt is too long (max 4000)." };
  }

  let modelId = resolveStudioImageModelId(input.modelId);
  let model = getStudioImageModel(modelId);
  if (!model) return { error: "Unknown model." };

  let notice: string | undefined;

  if (model.provider === "gemini" && !isGeminiConfigured()) {
    if (!isHiggsfieldConfigured()) {
      return {
        error:
          "Nano Banana Pro not configured (set GEMINI_API_KEY). Higgsfield fallback is also unavailable — add HF_API_KEY + HF_API_SECRET.",
      };
    }
    notice =
      "Nano Banana Pro not configured (set GEMINI_API_KEY). Falling back to Soul Standard.";
    modelId = DEFAULT_HIGGSFIELD_FALLBACK_MODEL;
    model = getStudioImageModel(modelId);
    if (!model) return { error: "Fallback model unavailable." };
  }

  const aspectRatio = resolveAspectRatio(modelId, input.aspectRatio);

  if (model.provider === "gemini") {
    const imageSize = resolveImageSize(input.imageSize);
    try {
      const generated = await generateNanoBananaProImage({
        prompt,
        aspectRatio,
        imageSize,
      });
      return {
        error: null,
        provider: "gemini",
        modelId,
        aspectRatio,
        imageSize,
        bytes: generated.bytes,
        contentType: generated.contentType,
        extension: generated.extension,
        notice,
      };
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Gemini image generation failed.",
      };
    }
  }

  if (!isHiggsfieldConfigured()) {
    return {
      error:
        "Higgsfield is not configured. Add HF_API_KEY and HF_API_SECRET in Vercel / .env.local.",
    };
  }

  try {
    const { requestId } = await submitHiggsfieldImage({
      modelId: modelId as HiggsfieldImageModelId,
      prompt,
      aspectRatio,
    });
    return {
      error: null,
      provider: "higgsfield",
      modelId,
      aspectRatio,
      requestId,
      notice,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not start generation.",
    };
  }
}
