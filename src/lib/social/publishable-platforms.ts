import "server-only";

import {
  canPublishWithLinkedIn,
  isLinkedInConfigured,
  linkedinPublishablePlatforms,
} from "@/lib/social/linkedin-publish";
import {
  canPublishWithMeta,
  isMetaConfigured,
  metaPublishablePlatforms,
} from "@/lib/social/meta-publish";
import {
  canPublishWithPinterest,
  isPinterestConfigured,
  pinterestPublishablePlatforms,
} from "@/lib/social/pinterest-publish";
import {
  canPublishWithThreads,
  isThreadsConfigured,
  threadsPublishablePlatforms,
} from "@/lib/social/threads-publish";
import {
  canPublishWithTikTok,
  isTikTokConfigured,
  tiktokPublishablePlatforms,
} from "@/lib/social/tiktok-publish";
import {
  canPublishWithX,
  isXConfigured,
  xPublishablePlatforms,
} from "@/lib/social/x-publish";
import {
  canPublishWithYouTube,
  isYouTubeConfigured,
  youtubePublishablePlatforms,
} from "@/lib/social/youtube-publish";
import type { SocialPlatform } from "@/lib/social/platforms";

/** Platforms that can one-click / cron publish with current env. */
export function apiPublishablePlatforms(): SocialPlatform[] {
  return [
    ...metaPublishablePlatforms(),
    ...linkedinPublishablePlatforms(),
    ...tiktokPublishablePlatforms(),
    ...threadsPublishablePlatforms(),
    ...pinterestPublishablePlatforms(),
    ...xPublishablePlatforms(),
    ...youtubePublishablePlatforms(),
  ];
}

export function canPublishViaApi(platform: SocialPlatform): boolean {
  return (
    canPublishWithMeta(platform) ||
    canPublishWithLinkedIn(platform) ||
    canPublishWithTikTok(platform) ||
    canPublishWithThreads(platform) ||
    canPublishWithPinterest(platform) ||
    canPublishWithX(platform) ||
    canPublishWithYouTube(platform)
  );
}

export function isAnySocialApiConfigured(): boolean {
  return (
    isMetaConfigured() ||
    isLinkedInConfigured() ||
    isTikTokConfigured() ||
    isThreadsConfigured() ||
    isPinterestConfigured() ||
    isXConfigured() ||
    isYouTubeConfigured()
  );
}
