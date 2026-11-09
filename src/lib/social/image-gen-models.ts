/**
 * Admin Social Studio image-generation model registry.
 * Providers: Google Gemini (Nano Banana Pro) + Higgsfield Cloud API.
 */

import {
  HIGGSFIELD_IMAGE_MODELS,
  type HiggsfieldAspectRatio,
  type HiggsfieldImageModelId,
} from "@/lib/higgsfield/models";

export type StudioImageProvider = "gemini" | "higgsfield";

export type StudioImageAspectRatio = HiggsfieldAspectRatio;

export type StudioImageModelId =
  | "google/nano-banana-pro"
  | HiggsfieldImageModelId;

export type StudioImageModel = {
  id: StudioImageModelId;
  provider: StudioImageProvider;
  label: string;
  description: string;
  aspectRatios: StudioImageAspectRatio[];
  defaultAspectRatio: StudioImageAspectRatio;
  /** Higgsfield Cloud model payload builder (higgsfield provider only). */
  buildPayload?: (input: {
    prompt: string;
    aspectRatio: StudioImageAspectRatio;
  }) => Record<string, unknown>;
};

const NANO_BANANA_PRO: StudioImageModel = {
  id: "google/nano-banana-pro",
  provider: "gemini",
  label: "Nano Banana Pro",
  description:
    "Google Gemini 3 Pro Image — default Social Studio generator (requires GEMINI_API_KEY)",
  aspectRatios: [
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
  ],
  defaultAspectRatio: "4:5",
};

export const STUDIO_IMAGE_MODELS: StudioImageModel[] = [
  NANO_BANANA_PRO,
  ...HIGGSFIELD_IMAGE_MODELS.map((model) => ({
    id: model.id as StudioImageModelId,
    provider: "higgsfield" as const,
    label: model.label,
    description: model.description,
    aspectRatios: model.aspectRatios,
    defaultAspectRatio: model.defaultAspectRatio,
    buildPayload: model.buildPayload,
  })),
];

export const DEFAULT_STUDIO_IMAGE_MODEL: StudioImageModelId =
  "google/nano-banana-pro";

export const DEFAULT_HIGGSFIELD_FALLBACK_MODEL: StudioImageModelId =
  "higgsfield-ai/soul/standard";

export function getStudioImageModel(id: string): StudioImageModel | null {
  return STUDIO_IMAGE_MODELS.find((model) => model.id === id) ?? null;
}

export function resolveStudioImageModelId(
  preferred?: string | null,
): StudioImageModelId {
  const fromEnv =
    process.env.STUDIO_IMAGE_MODEL?.trim() ||
    process.env.HF_IMAGE_MODEL?.trim() ||
    "";
  if (preferred && getStudioImageModel(preferred)) {
    return preferred as StudioImageModelId;
  }
  if (fromEnv && getStudioImageModel(fromEnv)) {
    return fromEnv as StudioImageModelId;
  }
  return DEFAULT_STUDIO_IMAGE_MODEL;
}
