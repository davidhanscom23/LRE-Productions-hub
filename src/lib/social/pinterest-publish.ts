import "server-only";

import {
  isPostForMeConfigured,
  publishViaPostForMe,
} from "@/lib/social/postforme";
import type { SocialPlatform } from "@/lib/social/platforms";

/**
 * Pinterest publishing via Post for Me.
 * Pins require at least one image. Prefer a per-draft board via `boardIds`;
 * otherwise uses POSTFORME_PINTEREST_DEFAULT_BOARD_ID (Real Life Weddings).
 * Optional link via env or publish input.
 */
export function isPinterestConfigured(): boolean {
  return isPostForMeConfigured();
}

export function pinterestPublishablePlatforms(): SocialPlatform[] {
  return isPinterestConfigured() ? ["pinterest"] : [];
}

export function canPublishWithPinterest(platform: SocialPlatform): boolean {
  return platform === "pinterest" && isPinterestConfigured();
}

export type PinterestPublishInput = {
  caption: string;
  /** Public HTTPS image URLs — at least one required. */
  imageUrls: string[];
  /** Post for Me connection id (spc_…). Overrides env default. */
  accountId?: string | null;
  /** Destination URL when the pin is clicked. */
  link?: string | null;
  /** Additional boards beyond the account default. */
  boardIds?: string[];
};

export type PinterestPublishResult = {
  externalPostId: string | null;
  error: string | null;
};

export async function publishToPinterest(
  input: PinterestPublishInput,
): Promise<PinterestPublishResult> {
  if (!isPinterestConfigured()) {
    return {
      externalPostId: null,
      error: "Pinterest is not configured. Set POSTFORME_API_KEY.",
    };
  }

  const account =
    input.accountId?.trim() ||
    process.env.POSTFORME_PINTEREST_ACCOUNT_ID?.trim() ||
    "";
  if (!account) {
    return {
      externalPostId: null,
      error:
        "Choose a Pinterest account for this draft (or set POSTFORME_PINTEREST_ACCOUNT_ID).",
    };
  }

  const imageUrls = (input.imageUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 1);

  if (imageUrls.length === 0) {
    return {
      externalPostId: null,
      error: "Pinterest requires at least one image on the draft.",
    };
  }

  const caption = input.caption.trim();
  if (!caption) {
    return {
      externalPostId: null,
      error: "Add a caption before posting to Pinterest.",
    };
  }

  const platformConfig: Record<string, unknown> = {};
  const link =
    input.link?.trim() ||
    process.env.POSTFORME_PINTEREST_LINK?.trim() ||
    "";
  if (link) platformConfig.link = link;

  const boardIds =
    input.boardIds?.map((id) => id.trim()).filter(Boolean) ?? [];
  const defaultBoard =
    process.env.POSTFORME_PINTEREST_DEFAULT_BOARD_ID?.trim() || "";
  const resolvedBoards =
    boardIds.length > 0
      ? boardIds
      : defaultBoard
        ? [defaultBoard]
        : [];
  if (resolvedBoards.length > 0) {
    platformConfig.board_ids = resolvedBoards;
  }

  const result = await publishViaPostForMe("pinterest", {
    accountId: account,
    caption: caption.slice(0, 500),
    mediaUrls: imageUrls,
    // Inner fields only — publishViaPostForMe nests under "pinterest".
    platformConfig,
  });

  if (result.error) {
    return {
      externalPostId: null,
      error: result.error.startsWith("Pinterest:")
        ? result.error
        : `Pinterest: ${result.error}`,
    };
  }

  return { externalPostId: result.externalPostId, error: null };
}
