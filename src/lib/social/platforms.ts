export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "twitter",
  "youtube",
  "threads",
  "pinterest",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  twitter: "X (Twitter)",
  youtube: "YouTube",
  threads: "Threads",
  pinterest: "Pinterest",
};

/** Max attachments selectable per draft for each network. */
export const PLATFORM_MAX_MEDIA: Record<SocialPlatform, number> = {
  facebook: 10,
  instagram: 10,
  linkedin: 20,
  tiktok: 35,
  twitter: 4,
  youtube: 1,
  threads: 20,
  pinterest: 1,
};

export type PlatformMediaRule = {
  max: number;
  allowImages: boolean;
  allowVideos: boolean;
  /** X/TikTok/Threads: images and video cannot be mixed in one post. */
  exclusiveTypes: boolean;
};

export const PLATFORM_MEDIA_RULES: Record<SocialPlatform, PlatformMediaRule> = {
  facebook: {
    max: PLATFORM_MAX_MEDIA.facebook,
    allowImages: true,
    allowVideos: true,
    exclusiveTypes: false,
  },
  instagram: {
    max: PLATFORM_MAX_MEDIA.instagram,
    allowImages: true,
    allowVideos: true,
    exclusiveTypes: false,
  },
  linkedin: {
    max: PLATFORM_MAX_MEDIA.linkedin,
    allowImages: true,
    allowVideos: false,
    exclusiveTypes: false,
  },
  tiktok: {
    max: PLATFORM_MAX_MEDIA.tiktok,
    allowImages: true,
    allowVideos: true,
    exclusiveTypes: true,
  },
  twitter: {
    max: PLATFORM_MAX_MEDIA.twitter,
    allowImages: true,
    allowVideos: true,
    exclusiveTypes: true,
  },
  youtube: {
    max: PLATFORM_MAX_MEDIA.youtube,
    allowImages: false,
    allowVideos: true,
    exclusiveTypes: false,
  },
  threads: {
    max: PLATFORM_MAX_MEDIA.threads,
    allowImages: true,
    allowVideos: true,
    exclusiveTypes: true,
  },
  pinterest: {
    max: PLATFORM_MAX_MEDIA.pinterest,
    allowImages: true,
    allowVideos: false,
    exclusiveTypes: false,
  },
};

export function platformMediaLimitLabel(platform: SocialPlatform): string {
  const rule = PLATFORM_MEDIA_RULES[platform];
  const kinds = [
    rule.allowImages ? "photos" : null,
    rule.allowVideos ? "videos" : null,
  ]
    .filter(Boolean)
    .join(" / ");
  const mix = rule.exclusiveTypes ? " (photos or video, not both)" : "";
  return `Up to ${rule.max} ${kinds}${mix}`;
}

/** Recommended export sizes for marketing stills / thumbnails. */
export type PlatformImageFormat = {
  id: string;
  label: string;
  width: number;
  height: number;
  platforms: SocialPlatform[];
};

export const PLATFORM_IMAGE_FORMATS: PlatformImageFormat[] = [
  {
    id: "square",
    label: "Square feed (1080×1080)",
    width: 1080,
    height: 1080,
    platforms: ["instagram", "facebook", "linkedin", "threads"],
  },
  {
    id: "portrait",
    label: "Portrait / Reels / Stories (1080×1350)",
    width: 1080,
    height: 1350,
    platforms: ["instagram", "facebook", "pinterest", "threads"],
  },
  {
    id: "story",
    label: "Story / TikTok vertical (1080×1920)",
    width: 1080,
    height: 1920,
    platforms: ["instagram", "tiktok", "facebook", "threads"],
  },
  {
    id: "landscape",
    label: "Landscape link preview (1200×630)",
    width: 1200,
    height: 630,
    platforms: ["facebook", "linkedin", "twitter"],
  },
  {
    id: "x-post",
    label: "X post (1600×900)",
    width: 1600,
    height: 900,
    platforms: ["twitter"],
  },
  {
    id: "youtube-thumb",
    label: "YouTube thumbnail / landscape (1280×720)",
    width: 1280,
    height: 720,
    platforms: ["youtube"],
  },
];

export const PLATFORM_CAPTION_GUIDANCE: Record<SocialPlatform, string> = {
  facebook:
    "Best practices: warm story-driven voice; 2–4 short paragraphs; light emoji ok; soft CTA + website near the end; 3–6 relevant hashtags. Local SEO/AEO: name the venue, city/area, event type, and brand naturally in the first half so people and answer engines can see who/what/where.",
  instagram:
    "Best practices: hook in line 1; line breaks for scannability; ~125–300 words feel; brand handle once; 8–15 relevant hashtags at the end (mix local + service + event). Local SEO/AEO: lead with city/venue + event type + event-production service language without stuffing.",
  linkedin:
    "Best practices: professional tone; celebrate craftsmanship/teamwork; 1–3 short paragraphs; 3–5 hashtags; no slang-heavy TikTok voice. Local SEO/AEO: mention venue, city, and service clearly for local search and AI summaries.",
  tiktok:
    "Best practices: punchy conversational hook first; keep much shorter than the ~2200-char max; trendy but brand-safe; 4–8 hashtags mixing broad + local. Local SEO/AEO: weave city/venue/event type into the spoken-style caption so discovery and AI overviews can place the brand.",
  twitter:
    "Best practices: under ~260 characters so a link can fit; one sharp line + location/team cue; 2–4 hashtags; no long stories. Local SEO/AEO: pack venue or city + event type into the single line without fluff.",
  youtube:
    "Best practices: first line = video title under ~70 chars (clear + local); blank line; then 2–4 short description paragraphs with soft CTA and 5–12 hashtags. Local SEO/AEO: title and opening description should answer who/what/where (brand, event production, venue, city) for YouTube search and AI answers — not a feed caption.",
  threads:
    "Best practices: conversational, human, ≤500 characters; 1–3 hashtags max; avoid link-heavy CTAs (Threads deprioritizes links). Local SEO/AEO: still name venue/city/event type naturally in plain language.",
  pinterest:
    "Best practices: keyword-rich pin description ≤500 characters; describe the scene; hashtags optional; assume a strong vertical (2:3) image. Local SEO/AEO: front-load searchable phrases — city, venue, event type, event-production service — so Pinterest search and AI assistants can match the pin.",
};
