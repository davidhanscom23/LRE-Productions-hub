import "server-only";

import {
  isPostForMeConfigured,
  publishViaPostForMe,
} from "@/lib/social/postforme";
import type { SocialPlatform } from "@/lib/social/platforms";

/**
 * TikTok publishing via Post for Me (https://postforme.dev).
 *
 * Post for Me's own app is audited by TikTok, so posts made through it go out
 * public without this project needing its own TikTok Content Posting audit.
 * Connect the TikTok account once in the Post for Me dashboard, then set:
 *   POSTFORME_API_KEY            — dashboard API key
 *   POSTFORME_TIKTOK_ACCOUNT_ID  — default connected TikTok account id (spc_...)
 *   POSTFORME_TIKTOK_PRIVACY     — "public" (default) or "private"
 *   POSTFORME_TIKTOK_DRAFT       — truthy → TikTok inbox draft (no Direct Post)
 *
 * Per-draft brand override: pass `accountId` on publish.
 */
export type TikTokConfig = {
  apiKey: string;
  accountId: string;
  privacyStatus: "public" | "private";
  /** Send to TikTok drafts/inbox for manual publish instead of Direct Post. */
  draft: boolean;
};

export function getTikTokConfig(): TikTokConfig | null {
  const apiKey = process.env.POSTFORME_API_KEY?.trim() ?? "";
  const accountId = process.env.POSTFORME_TIKTOK_ACCOUNT_ID?.trim() ?? "";
  if (!apiKey || !accountId) return null;

  const privacy = process.env.POSTFORME_TIKTOK_PRIVACY?.trim().toLowerCase();
  const privacyStatus: "public" | "private" =
    privacy === "private" ? "private" : "public";

  const draft = /^(1|true|yes|on)$/i.test(
    process.env.POSTFORME_TIKTOK_DRAFT?.trim() ?? "",
  );

  return { apiKey, accountId, privacyStatus, draft };
}

export function isTikTokConfigured(): boolean {
  return getTikTokConfig() !== null;
}

export function tiktokPublishablePlatforms(): SocialPlatform[] {
  return isTikTokConfigured() ? ["tiktok"] : [];
}

export function canPublishWithTikTok(platform: SocialPlatform): boolean {
  return platform === "tiktok" && isTikTokConfigured();
}

export type TikTokPublishInput = {
  caption: string;
  /** Public HTTPS video URL — preferred for TikTok. */
  videoUrl?: string | null;
  /** @deprecated Prefer videoUrl. */
  imageUrl?: string | null;
  /** Public HTTPS image URLs for a photo carousel when there is no video. */
  imageUrls?: string[];
  /** Post for Me connection id override (spc_…). */
  accountId?: string | null;
};

export type TikTokPublishResult = {
  externalPostId: string | null;
  error: string | null;
};

/**
 * Publish to the connected TikTok account via Post for Me. Prefers a video;
 * falls back to a photo carousel when no video is supplied.
 */
export async function publishToTikTok(
  input: TikTokPublishInput,
): Promise<TikTokPublishResult> {
  if (!isPostForMeConfigured()) {
    return {
      externalPostId: null,
      error:
        "TikTok is not configured. Set POSTFORME_API_KEY and POSTFORME_TIKTOK_ACCOUNT_ID.",
    };
  }

  const config = getTikTokConfig();
  const account =
    input.accountId?.trim() ||
    config?.accountId ||
    process.env.POSTFORME_TIKTOK_ACCOUNT_ID?.trim() ||
    "";
  if (!account) {
    return {
      externalPostId: null,
      error:
        "Choose a TikTok account for this draft (or set POSTFORME_TIKTOK_ACCOUNT_ID).",
    };
  }

  const privacyStatus = config?.privacyStatus ?? "public";
  const draft = config?.draft ?? false;

  const videoUrl = input.videoUrl?.trim() ?? "";
  const imageUrls = (
    input.imageUrls?.length
      ? input.imageUrls
      : input.imageUrl
        ? [input.imageUrl]
        : []
  )
    .map((url) => url.trim())
    .filter(Boolean);

  const mediaUrls = videoUrl
    ? [videoUrl]
    : imageUrls.slice(0, 35);

  if (mediaUrls.length === 0) {
    return {
      externalPostId: null,
      error: "TikTok posts need a video or at least one image on the draft.",
    };
  }

  const caption = input.caption.trim();
  const title =
    caption.split("\n").find((line) => line.trim())?.trim().slice(0, 90) ||
    "Event highlight";

  const result = await publishViaPostForMe("tiktok", {
    accountId: account,
    caption,
    mediaUrls,
    platformConfig: {
      title,
      privacy_status: privacyStatus,
      // TikTok requires music for photo posts; video carries its own audio.
      auto_add_music: !videoUrl,
      // Draft mode uploads to the TikTok inbox for manual publish,
      // avoiding the Direct Post audit requirement.
      is_draft: draft,
    },
  });

  if (result.error) {
    return {
      externalPostId: null,
      error: result.error.startsWith("TikTok:")
        ? result.error
        : `TikTok: ${result.error}`,
    };
  }

  return { externalPostId: result.externalPostId, error: null };
}
