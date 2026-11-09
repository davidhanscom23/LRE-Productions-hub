import {
  PLATFORM_MEDIA_RULES,
  type SocialPlatform,
} from "@/lib/social/platforms";
import { isImageMediaItem, isVideoMediaItem } from "@/lib/media/file-kind";

export type DraftMediaCandidate = {
  id: string;
  file_name: string;
  media_type: string;
};

export function normalizeMediaIds(ids: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids ?? []) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Filter packet media to what a platform can attach (e.g. YouTube → videos only). */
export function compatibleMediaForPlatform<T extends DraftMediaCandidate>(
  platform: SocialPlatform,
  items: T[],
): T[] {
  const rule = PLATFORM_MEDIA_RULES[platform];
  return items.filter((item) => {
    const isImage = isImageMediaItem(item);
    const isVideo = isVideoMediaItem(item);
    if (isImage) return rule.allowImages;
    if (isVideo) return rule.allowVideos;
    return false;
  });
}

export function validateDraftMediaSelection(options: {
  platform: SocialPlatform;
  selected: DraftMediaCandidate[];
}): { error: string | null; mediaIds: string[] } {
  const rule = PLATFORM_MEDIA_RULES[options.platform];
  const selected = options.selected;

  if (selected.length > rule.max) {
    return {
      error: `${options.platform} allows up to ${rule.max} attachment${rule.max === 1 ? "" : "s"}.`,
      mediaIds: [],
    };
  }

  let imageCount = 0;
  let videoCount = 0;
  for (const item of selected) {
    const isImage = isImageMediaItem(item);
    const isVideo = isVideoMediaItem(item);
    if (!isImage && !isVideo) {
      return {
        error: `“${item.file_name}” is not a supported photo or video.`,
        mediaIds: [],
      };
    }
    if (isImage && !rule.allowImages) {
      return {
        error: `${options.platform} drafts need video, not photos.`,
        mediaIds: [],
      };
    }
    if (isVideo && !rule.allowVideos) {
      return {
        error: `${options.platform} drafts need photos (video isn’t supported for API publish yet).`,
        mediaIds: [],
      };
    }
    if (isImage) imageCount += 1;
    if (isVideo) videoCount += 1;
  }

  if (rule.exclusiveTypes && imageCount > 0 && videoCount > 0) {
    return {
      error: `${options.platform} can’t mix photos and video in one post. Pick one type.`,
      mediaIds: [],
    };
  }

  if (options.platform === "twitter" && videoCount > 1) {
    return {
      error: "X allows at most one video per post.",
      mediaIds: [],
    };
  }

  if (options.platform === "threads" && videoCount > 1) {
    return {
      error: "Threads allows at most one video per post.",
      mediaIds: [],
    };
  }

  if (options.platform === "youtube" && videoCount !== selected.length) {
    return {
      error: "YouTube drafts need a single video.",
      mediaIds: [],
    };
  }

  return {
    error: null,
    mediaIds: selected.map((item) => item.id),
  };
}
