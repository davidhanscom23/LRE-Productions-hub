import "server-only";

import { createHmac, randomBytes } from "crypto";
import type { SocialPlatform } from "@/lib/social/platforms";

/**
 * X (Twitter) posting via OAuth 1.0a user context (long-lived company tokens)
 * or OAuth 2.0 user access token (X_OAUTH2_ACCESS_TOKEN).
 */

export type XConfig =
  | {
      mode: "oauth1";
      apiKey: string;
      apiSecret: string;
      accessToken: string;
      accessTokenSecret: string;
    }
  | {
      mode: "oauth2";
      accessToken: string;
    };

export function getXConfig(): XConfig | null {
  const oauth2 = process.env.X_OAUTH2_ACCESS_TOKEN?.trim() ?? "";
  if (oauth2) return { mode: "oauth2", accessToken: oauth2 };

  const apiKey = process.env.X_API_KEY?.trim() ?? "";
  const apiSecret = process.env.X_API_SECRET?.trim() ?? "";
  const accessToken = process.env.X_ACCESS_TOKEN?.trim() ?? "";
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET?.trim() ?? "";
  if (apiKey && apiSecret && accessToken && accessTokenSecret) {
    return {
      mode: "oauth1",
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
    };
  }
  return null;
}

export function isXConfigured(): boolean {
  return getXConfig() !== null;
}

export function xPublishablePlatforms(): SocialPlatform[] {
  return isXConfigured() ? ["twitter"] : [];
}

export function canPublishWithX(platform: SocialPlatform): boolean {
  return platform === "twitter" && isXConfigured();
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function oauth1Header(
  method: string,
  url: string,
  config: Extract<XConfig, { mode: "oauth1" }>,
  extraParams: Record<string, string> = {},
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: config.accessToken,
    oauth_version: "1.0",
  };

  const baseParams: Record<string, string> = { ...extraParams, ...oauth };
  const paramString = Object.keys(baseParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(baseParams[key]!)}`)
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(
    config.accessTokenSecret,
  )}`;
  const signature = createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  oauth.oauth_signature = signature;

  const header = Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key]!)}"`)
    .join(", ");

  return `OAuth ${header}`;
}

async function authHeaders(
  config: XConfig,
  method: string,
  url: string,
  extraParams?: Record<string, string>,
): Promise<HeadersInit> {
  if (config.mode === "oauth2") {
    return { Authorization: `Bearer ${config.accessToken}` };
  }
  return {
    Authorization: oauth1Header(method, url, config, extraParams),
  };
}

async function uploadImageMedia(
  config: XConfig,
  bytes: Buffer,
  mimeType: string,
): Promise<{ mediaId: string | null; error: string | null }> {
  const initUrl = "https://api.x.com/2/media/upload";
  const initParams = {
    command: "INIT",
    media_type: mimeType || "image/jpeg",
    total_bytes: String(bytes.length),
    media_category: "tweet_image",
  };

  const initBody = new URLSearchParams(initParams);
  const initRes = await fetch(initUrl, {
    method: "POST",
    headers: {
      ...(await authHeaders(config, "POST", initUrl, initParams)),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: initBody,
    cache: "no-store",
  });

  const initJson = (await initRes.json().catch(() => ({}))) as {
    data?: { id?: string; media_id_string?: string };
    media_id_string?: string;
    detail?: string;
    title?: string;
  };

  const mediaId =
    initJson.data?.id ||
    initJson.data?.media_id_string ||
    initJson.media_id_string ||
    null;

  if (!initRes.ok || !mediaId) {
    return {
      mediaId: null,
      error:
        initJson.detail ||
        initJson.title ||
        `X media INIT failed (${initRes.status}).`,
    };
  }

  const appendUrl = "https://api.x.com/2/media/upload";
  const form = new FormData();
  form.set("command", "APPEND");
  form.set("media_id", mediaId);
  form.set("segment_index", "0");
  form.set(
    "media",
    new Blob([new Uint8Array(bytes)], { type: mimeType || "image/jpeg" }),
    "media.jpg",
  );

  const appendRes = await fetch(appendUrl, {
    method: "POST",
    headers: await authHeaders(config, "POST", appendUrl),
    body: form,
    cache: "no-store",
  });

  if (!appendRes.ok && appendRes.status !== 204) {
    const text = await appendRes.text().catch(() => "");
    return {
      mediaId: null,
      error: text || `X media APPEND failed (${appendRes.status}).`,
    };
  }

  const finalizeParams = {
    command: "FINALIZE",
    media_id: mediaId,
  };
  const finalizeRes = await fetch(appendUrl, {
    method: "POST",
    headers: {
      ...(await authHeaders(config, "POST", appendUrl, finalizeParams)),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(finalizeParams),
    cache: "no-store",
  });

  if (!finalizeRes.ok) {
    const json = (await finalizeRes.json().catch(() => ({}))) as {
      detail?: string;
      title?: string;
    };
    return {
      mediaId: null,
      error:
        json.detail ||
        json.title ||
        `X media FINALIZE failed (${finalizeRes.status}).`,
    };
  }

  return { mediaId, error: null };
}

export type XPublishInput = {
  caption: string;
  /** @deprecated Prefer imageUrls */
  imageUrl?: string | null;
  imageUrls?: string[];
};

export type XPublishResult = {
  externalPostId: string | null;
  error: string | null;
};

/**
 * Create a post on X (twitter platform key in drafts).
 * Text-only or text + image via chunked media upload.
 */
export async function publishToX(
  input: XPublishInput,
): Promise<XPublishResult> {
  const config = getXConfig();
  if (!config) {
    return {
      externalPostId: null,
      error:
        "X is not configured. Set X_OAUTH2_ACCESS_TOKEN or X_API_KEY + X_API_SECRET + X_ACCESS_TOKEN + X_ACCESS_TOKEN_SECRET.",
    };
  }

  let text = input.caption.trim();
  if (text.length > 280) {
    text = `${text.slice(0, 277)}...`;
  }

  const imageUrls = (
    input.imageUrls?.length
      ? input.imageUrls
      : input.imageUrl
        ? [input.imageUrl]
        : []
  )
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 4);

  let mediaIds: string[] | undefined;
  if (imageUrls.length) {
    mediaIds = [];
    for (const imageUrl of imageUrls) {
      const imageRes = await fetch(imageUrl, { cache: "no-store" });
      if (!imageRes.ok) {
        return {
          externalPostId: null,
          error: `Could not download image for X (${imageRes.status}).`,
        };
      }
      const bytes = Buffer.from(await imageRes.arrayBuffer());
      const mimeType =
        imageRes.headers.get("content-type") || "image/jpeg";
      const uploaded = await uploadImageMedia(config, bytes, mimeType);
      if (uploaded.error || !uploaded.mediaId) {
        return {
          externalPostId: null,
          error: uploaded.error ?? "X media upload failed.",
        };
      }
      mediaIds.push(uploaded.mediaId);
    }
  }

  if (!text && !mediaIds?.length) {
    return {
      externalPostId: null,
      error: "X posts need a caption or an image.",
    };
  }

  const tweetUrl = "https://api.x.com/2/tweets";
  const body: Record<string, unknown> = {};
  if (text) body.text = text;
  if (mediaIds?.length) body.media = { media_ids: mediaIds };

  const res = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      ...(await authHeaders(config, "POST", tweetUrl)),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
    errors?: { detail?: string; message?: string }[];
  };

  if (!res.ok || !json.data?.id) {
    return {
      externalPostId: null,
      error:
        json.detail ||
        json.title ||
        json.errors?.[0]?.detail ||
        json.errors?.[0]?.message ||
        `X post failed (${res.status}).`,
    };
  }

  return { externalPostId: json.data.id, error: null };
}
