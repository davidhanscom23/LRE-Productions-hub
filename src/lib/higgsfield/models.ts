/**
 * Official Cloud API image models (platform.higgsfield.ai + KEY:SECRET).
 * Social Studio also offers Google Nano Banana Pro via Gemini — see
 * `src/lib/social/image-gen-models.ts` for the combined registry.
 */

export type HiggsfieldAspectRatio =
  | "1:1"
  | "4:5"
  | "5:4"
  | "3:4"
  | "4:3"
  | "9:16"
  | "16:9"
  | "3:2"
  | "2:3"
  | "21:9";

export type HiggsfieldImageModelId =
  | "higgsfield-ai/soul/standard"
  | "bytedance/seedream/v4/text-to-image"
  | "flux-pro/kontext/max/text-to-image"
  | "reve/text-to-image";

export type HiggsfieldImageModel = {
  id: HiggsfieldImageModelId;
  label: string;
  description: string;
  aspectRatios: HiggsfieldAspectRatio[];
  defaultAspectRatio: HiggsfieldAspectRatio;
  /** Extra fields sent with prompt + aspect_ratio */
  buildPayload: (input: {
    prompt: string;
    aspectRatio: HiggsfieldAspectRatio;
  }) => Record<string, unknown>;
};

export const HIGGSFIELD_IMAGE_MODELS: HiggsfieldImageModel[] = [
  {
    id: "higgsfield-ai/soul/standard",
    label: "Soul Standard",
    description: "Higgsfield flagship photorealistic text-to-image",
    aspectRatios: ["1:1", "9:16", "16:9", "3:4", "4:3"],
    defaultAspectRatio: "4:3",
    buildPayload: ({ prompt, aspectRatio }) => ({
      prompt,
      aspect_ratio: aspectRatio,
      resolution: "1080p",
    }),
  },
  {
    id: "bytedance/seedream/v4/text-to-image",
    label: "Seedream v4",
    description: "Strong detail for marketing and lifestyle stills",
    aspectRatios: ["1:1", "9:16", "16:9", "4:3", "3:4", "3:2", "2:3"],
    defaultAspectRatio: "4:3",
    buildPayload: ({ prompt, aspectRatio }) => ({
      prompt,
      aspect_ratio: aspectRatio,
      resolution: "2K",
      camera_fixed: false,
    }),
  },
  {
    id: "flux-pro/kontext/max/text-to-image",
    label: "FLUX.1 Kontext Max",
    description: "High-control text-to-image from Black Forest Labs",
    aspectRatios: ["1:1", "9:16", "16:9", "4:3", "3:4"],
    defaultAspectRatio: "4:3",
    buildPayload: ({ prompt, aspectRatio }) => ({
      prompt,
      aspect_ratio: aspectRatio,
      safety_tolerance: 2,
    }),
  },
  {
    id: "reve/text-to-image",
    label: "Reve",
    description: "Versatile text-to-image",
    aspectRatios: ["1:1", "9:16", "16:9", "3:4", "4:3"],
    defaultAspectRatio: "4:3",
    buildPayload: ({ prompt, aspectRatio }) => ({
      prompt,
      aspect_ratio: aspectRatio,
    }),
  },
];

export const DEFAULT_HIGGSFIELD_IMAGE_MODEL: HiggsfieldImageModelId =
  "higgsfield-ai/soul/standard";

export function getHiggsfieldImageModel(
  id: string,
): HiggsfieldImageModel | null {
  return HIGGSFIELD_IMAGE_MODELS.find((model) => model.id === id) ?? null;
}

export function resolveHiggsfieldImageModelId(
  preferred?: string | null,
): HiggsfieldImageModelId {
  const fromEnv = process.env.HF_IMAGE_MODEL?.trim();
  if (preferred && getHiggsfieldImageModel(preferred)) {
    return preferred as HiggsfieldImageModelId;
  }
  if (fromEnv && getHiggsfieldImageModel(fromEnv)) {
    return fromEnv as HiggsfieldImageModelId;
  }
  return DEFAULT_HIGGSFIELD_IMAGE_MODEL;
}
