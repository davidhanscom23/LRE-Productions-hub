import "server-only";

import {
  isPostForMeConfigured,
  publishViaPostForMe,
} from "@/lib/social/postforme";
import type { SocialPlatform } from "@/lib/social/platforms";

/**
 * Threads publishing via Post for Me.
 * Text-only is allowed; media optional. Per-draft brand: pass `accountId`.
 */
export function isThreadsConfigured(): boolean {
  return isPostForMeConfigured();
}

export function threadsPublishablePlatforms(): SocialPlatform[] {
  return isThreadsConfigured() ? ["threads"] : [];
}

export function canPublishWithThreads(platform: SocialPlatform): boolean {
  return platform === "threads" && isThreadsConfigured();
}

export type ThreadsPublishInput = {
  caption: string;
  /** Public HTTPS image URLs (optional; Threads allows text-only). */
  imageUrls?: string[];
  /** Public HTTPS video URL — if set, used instead of images. */
  videoUrl?: string | null;
  /** Post for Me connection id (spc_…). Overrides env default. */
  accountId?: string | null;
};

export type ThreadsPublishResult = {
  externalPostId: string | null;
  error: string | null;
};

export async function publishToThreads(
  input: ThreadsPublishInput,
): Promise<ThreadsPublishResult> {
  if (!isThreadsConfigured()) {
    return {
      externalPostId: null,
      error: "Threads is not configured. Set POSTFORME_API_KEY.",
    };
  }

  const account =
    input.accountId?.trim() ||
    process.env.POSTFORME_THREADS_ACCOUNT_ID?.trim() ||
    "";
  if (!account) {
    return {
      externalPostId: null,
      error:
        "Choose a Threads account for this draft (or set POSTFORME_THREADS_ACCOUNT_ID).",
    };
  }

  const caption = input.caption.trim();
  if (!caption) {
    return {
      externalPostId: null,
      error: "Add a caption before posting to Threads.",
    };
  }

  const videoUrl = input.videoUrl?.trim() ?? "";
  const imageUrls = (input.imageUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 20);

  const mediaUrls = videoUrl ? [videoUrl] : imageUrls;

  const result = await publishViaPostForMe("threads", {
    accountId: account,
    caption: caption.slice(0, 500),
    mediaUrls,
    platformConfig: {},
  });

  if (result.error) {
    return {
      externalPostId: null,
      error: result.error.startsWith("Threads:")
        ? result.error
        : `Threads: ${result.error}`,
    };
  }

  return { externalPostId: result.externalPostId, error: null };
}
