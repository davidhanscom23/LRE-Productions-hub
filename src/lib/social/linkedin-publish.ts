import "server-only";

import {
  isPostForMeConfigured,
  publishViaPostForMe,
} from "@/lib/social/postforme";
import type { SocialPlatform } from "@/lib/social/platforms";

/**
 * LinkedIn company-page publishing via Post for Me.
 * Per-draft brand/page: pass `accountId` (spc_…). Falls back to
 * POSTFORME_LINKEDIN_ACCOUNT_ID when set.
 *
 * Configured when POSTFORME_API_KEY is present (multi-brand picker supplies
 * the account). Native LINKEDIN_ACCESS_TOKEN / LINKEDIN_ORGANIZATION_ID are
 * no longer used.
 */
export function isLinkedInConfigured(): boolean {
  return isPostForMeConfigured();
}

export function linkedinPublishablePlatforms(): SocialPlatform[] {
  return isLinkedInConfigured() ? ["linkedin"] : [];
}

export function canPublishWithLinkedIn(platform: SocialPlatform): boolean {
  return platform === "linkedin" && isLinkedInConfigured();
}

export type LinkedInPublishInput = {
  caption: string;
  /** @deprecated Prefer imageUrls */
  imageUrl?: string | null;
  /** Public HTTPS image URLs (LinkedIn = images only). */
  imageUrls?: string[];
  /** Post for Me connection id (spc_…). Overrides env default. */
  accountId?: string | null;
};

export type LinkedInPublishResult = {
  externalPostId: string | null;
  error: string | null;
};

export async function publishToLinkedIn(
  input: LinkedInPublishInput,
): Promise<LinkedInPublishResult> {
  if (!isLinkedInConfigured()) {
    return {
      externalPostId: null,
      error: "LinkedIn is not configured. Set POSTFORME_API_KEY.",
    };
  }

  const account =
    input.accountId?.trim() ||
    process.env.POSTFORME_LINKEDIN_ACCOUNT_ID?.trim() ||
    "";
  if (!account) {
    return {
      externalPostId: null,
      error: "Choose a LinkedIn brand/page for this draft.",
    };
  }

  const caption = input.caption.trim();
  const mediaUrls = (
    input.imageUrls?.length
      ? input.imageUrls
      : input.imageUrl
        ? [input.imageUrl]
        : []
  )
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (!caption && mediaUrls.length === 0) {
    return {
      externalPostId: null,
      error: "LinkedIn posts need a caption or an image.",
    };
  }

  const result = await publishViaPostForMe("linkedin", {
    accountId: account,
    caption,
    mediaUrls,
  });

  if (result.error) {
    return {
      externalPostId: null,
      error: result.error.startsWith("LinkedIn:")
        ? result.error
        : `LinkedIn: ${result.error}`,
    };
  }

  return { externalPostId: result.externalPostId, error: null };
}
