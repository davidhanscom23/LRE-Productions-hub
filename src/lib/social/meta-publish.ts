import "server-only";

import type { SocialPlatform } from "@/lib/social/platforms";
import {
  formatIgCollaboratorsParam,
  normalizeIgCollaborators,
} from "@/lib/social/ig-collaborators";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type MetaConfig = {
  pageId: string;
  pageAccessToken: string;
  igUserId: string | null;
};

export function getMetaConfig(): MetaConfig | null {
  const pageId = process.env.META_PAGE_ID?.trim() ?? "";
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim() ?? "";
  const igUserId = process.env.META_IG_USER_ID?.trim() || null;

  if (!pageId || !pageAccessToken) return null;
  return { pageId, pageAccessToken, igUserId };
}

export function isMetaConfigured(): boolean {
  return getMetaConfig() !== null;
}

/** Platforms that can be published with the current Meta env. */
export function metaPublishablePlatforms(): SocialPlatform[] {
  const config = getMetaConfig();
  if (!config) return [];
  const platforms: SocialPlatform[] = ["facebook"];
  if (config.igUserId) platforms.push("instagram");
  return platforms;
}

export function canPublishWithMeta(platform: SocialPlatform): boolean {
  return metaPublishablePlatforms().includes(platform);
}

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number };
};

async function graphPost(
  path: string,
  params: Record<string, string>,
): Promise<{ id?: string; error: string | null }> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const body = new URLSearchParams(params);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & {
    id?: string;
  };

  if (!res.ok || json.error) {
    return {
      error:
        json.error?.message ??
        `Meta Graph API error (${res.status}) on ${path}.`,
    };
  }

  return { id: json.id, error: null };
}

export type MetaPublishInput = {
  platform: "facebook" | "instagram";
  caption: string;
  /** @deprecated Prefer imageUrls */
  imageUrl?: string | null;
  /** Public HTTPS image URLs Meta can fetch (carousel / multi-photo). */
  imageUrls?: string[];
  collaborators?: string[];
};

export type MetaPublishResult = {
  externalPostId: string | null;
  error: string | null;
};

function resolveImageUrls(input: MetaPublishInput): string[] {
  if (input.imageUrls?.length) {
    return input.imageUrls.map((url) => url.trim()).filter(Boolean);
  }
  return input.imageUrl?.trim() ? [input.imageUrl.trim()] : [];
}

async function publishFacebookMultiPhoto(
  config: MetaConfig,
  caption: string,
  imageUrls: string[],
): Promise<MetaPublishResult> {
  if (imageUrls.length === 1) {
    const result = await graphPost(`/${config.pageId}/photos`, {
      url: imageUrls[0]!,
      caption,
      published: "true",
      access_token: config.pageAccessToken,
    });
    return { externalPostId: result.id ?? null, error: result.error };
  }

  const attached: string[] = [];
  for (const imageUrl of imageUrls) {
    const unpublished = await graphPost(`/${config.pageId}/photos`, {
      url: imageUrl,
      published: "false",
      access_token: config.pageAccessToken,
    });
    if (unpublished.error || !unpublished.id) {
      return {
        externalPostId: null,
        error: unpublished.error ?? "Facebook multi-photo upload failed.",
      };
    }
    attached.push(unpublished.id);
  }

  const params: Record<string, string> = {
    message: caption,
    access_token: config.pageAccessToken,
  };
  attached.forEach((id, index) => {
    params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
  });

  const result = await graphPost(`/${config.pageId}/feed`, params);
  return { externalPostId: result.id ?? null, error: result.error };
}

async function publishInstagramCarousel(
  config: MetaConfig,
  caption: string,
  imageUrls: string[],
  collaborators: string[],
): Promise<MetaPublishResult> {
  if (!config.igUserId) {
    return {
      externalPostId: null,
      error:
        "Instagram publishing needs META_IG_USER_ID (IG professional account linked to the Page).",
    };
  }

  if (imageUrls.length === 1) {
    const mediaParams: Record<string, string> = {
      image_url: imageUrls[0]!,
      caption,
      access_token: config.pageAccessToken,
    };
    if (collaborators.length > 0) {
      mediaParams.collaborators = formatIgCollaboratorsParam(collaborators);
    }
    const container = await graphPost(`/${config.igUserId}/media`, mediaParams);
    if (container.error || !container.id) {
      return {
        externalPostId: null,
        error: container.error ?? "Instagram media container was not created.",
      };
    }
    await waitForIgContainer(container.id, config.pageAccessToken);
    const published = await graphPost(`/${config.igUserId}/media_publish`, {
      creation_id: container.id,
      access_token: config.pageAccessToken,
    });
    return { externalPostId: published.id ?? null, error: published.error };
  }

  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const child = await graphPost(`/${config.igUserId}/media`, {
      image_url: imageUrl,
      is_carousel_item: "true",
      access_token: config.pageAccessToken,
    });
    if (child.error || !child.id) {
      return {
        externalPostId: null,
        error: child.error ?? "Instagram carousel item failed.",
      };
    }
    await waitForIgContainer(child.id, config.pageAccessToken);
    childIds.push(child.id);
  }

  const parentParams: Record<string, string> = {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
    access_token: config.pageAccessToken,
  };
  if (collaborators.length > 0) {
    parentParams.collaborators = formatIgCollaboratorsParam(collaborators);
  }

  const parent = await graphPost(`/${config.igUserId}/media`, parentParams);
  if (parent.error || !parent.id) {
    return {
      externalPostId: null,
      error: parent.error ?? "Instagram carousel container failed.",
    };
  }
  await waitForIgContainer(parent.id, config.pageAccessToken);

  const published = await graphPost(`/${config.igUserId}/media_publish`, {
    creation_id: parent.id,
    access_token: config.pageAccessToken,
  });
  return { externalPostId: published.id ?? null, error: published.error };
}

/**
 * Publish photo(s) (or Facebook text-only) to the connected Page / IG account.
 */
export async function publishToMeta(
  input: MetaPublishInput,
): Promise<MetaPublishResult> {
  const config = getMetaConfig();
  if (!config) {
    return {
      externalPostId: null,
      error:
        "Meta is not configured. Set META_PAGE_ID and META_PAGE_ACCESS_TOKEN.",
    };
  }

  const caption = input.caption.trim();
  const imageUrls = resolveImageUrls(input);

  if (input.platform === "facebook") {
    if (imageUrls.length > 0) {
      return publishFacebookMultiPhoto(config, caption, imageUrls);
    }
    if (!caption) {
      return {
        externalPostId: null,
        error: "Facebook posts need a caption or an image.",
      };
    }
    const result = await graphPost(`/${config.pageId}/feed`, {
      message: caption,
      access_token: config.pageAccessToken,
    });
    return { externalPostId: result.id ?? null, error: result.error };
  }

  if (imageUrls.length === 0) {
    return {
      externalPostId: null,
      error: "Instagram posts require at least one image on the draft.",
    };
  }

  const collab = normalizeIgCollaborators(input.collaborators ?? []);
  if (collab.error) {
    return { externalPostId: null, error: collab.error };
  }

  return publishInstagramCarousel(
    config,
    caption,
    imageUrls,
    collab.usernames,
  );
}

async function waitForIgContainer(
  creationId: string,
  accessToken: string,
  attempts = 8,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    const url = new URL(`${GRAPH_BASE}/${creationId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      status_code?: string;
      error?: { message?: string };
    };
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR" || json.error) return;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
}
