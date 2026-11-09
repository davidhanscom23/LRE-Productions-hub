import "server-only";

import type { SocialPlatform } from "@/lib/social/platforms";

/**
 * YouTube Data API v3 one-click video upload.
 *
 * Preferred (durable): YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET +
 * YOUTUBE_REFRESH_TOKEN + YOUTUBE_CHANNEL_ID — Hub refreshes an access token
 * on the fly before each upload.
 *
 * Fallback: YOUTUBE_ACCESS_TOKEN + YOUTUBE_CHANNEL_ID (expires; refresh
 * manually in Google Cloud / OAuth playground with youtube.upload scope).
 */
export type YouTubeConfig = {
  accessToken: string;
  channelId: string;
  /** How credentials were resolved (for Hub health / logging). */
  mode: "refresh" | "access_token";
};

export type YouTubeCredentialStatus =
  | { status: "ready_refresh"; detail: string }
  | { status: "ready_access_token"; detail: string }
  | { status: "partial"; detail: string }
  | { status: "missing"; detail: string };

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getYouTubeCredentialStatus(): YouTubeCredentialStatus {
  const clientId = env("YOUTUBE_CLIENT_ID");
  const clientSecret = env("YOUTUBE_CLIENT_SECRET");
  const refreshToken = env("YOUTUBE_REFRESH_TOKEN");
  const accessToken = env("YOUTUBE_ACCESS_TOKEN");
  const channelId = env("YOUTUBE_CHANNEL_ID");

  const refreshParts = [clientId, clientSecret, refreshToken].filter(Boolean)
    .length;
  const hasRefreshTrio = Boolean(clientId && clientSecret && refreshToken);

  if (hasRefreshTrio && channelId) {
    return {
      status: "ready_refresh",
      detail:
        "Refresh-token OAuth is set (CLIENT_ID/SECRET/REFRESH_TOKEN + CHANNEL_ID).",
    };
  }
  if (accessToken && channelId) {
    return {
      status: "ready_access_token",
      detail:
        "Access-token-only mode (YOUTUBE_ACCESS_TOKEN + CHANNEL_ID). Tokens expire — prefer refresh-token credentials.",
    };
  }
  if (refreshParts > 0 || accessToken || channelId) {
    const missing: string[] = [];
    if (hasRefreshTrio && !channelId) missing.push("YOUTUBE_CHANNEL_ID");
    else if (!hasRefreshTrio && refreshParts > 0) {
      if (!clientId) missing.push("YOUTUBE_CLIENT_ID");
      if (!clientSecret) missing.push("YOUTUBE_CLIENT_SECRET");
      if (!refreshToken) missing.push("YOUTUBE_REFRESH_TOKEN");
      if (!channelId) missing.push("YOUTUBE_CHANNEL_ID");
    } else {
      if (!accessToken) missing.push("YOUTUBE_ACCESS_TOKEN");
      if (!channelId) missing.push("YOUTUBE_CHANNEL_ID");
    }
    return {
      status: "partial",
      detail: `YouTube env incomplete — missing ${missing.join(", ")}.`,
    };
  }
  return {
    status: "missing",
    detail:
      "No YouTube credentials. Set refresh-token OAuth (preferred) or YOUTUBE_ACCESS_TOKEN + YOUTUBE_CHANNEL_ID.",
  };
}

async function refreshAccessToken(): Promise<string | null> {
  const clientId = env("YOUTUBE_CLIENT_ID");
  const clientSecret = env("YOUTUBE_CLIENT_SECRET");
  const refreshToken = env("YOUTUBE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      "[youtube] token refresh failed",
      res.status,
      text.slice(0, 400),
    );
    return null;
  }
  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
  } | null;
  return json?.access_token?.trim() || null;
}

/**
 * Resolve a usable access token + channel id.
 * Prefers refresh-token flow; falls back to YOUTUBE_ACCESS_TOKEN.
 */
export async function resolveYouTubeConfig(): Promise<YouTubeConfig | null> {
  const channelId = env("YOUTUBE_CHANNEL_ID");
  if (!channelId) return null;

  const clientId = env("YOUTUBE_CLIENT_ID");
  const clientSecret = env("YOUTUBE_CLIENT_SECRET");
  const refreshToken = env("YOUTUBE_REFRESH_TOKEN");
  if (clientId && clientSecret && refreshToken) {
    const accessToken = await refreshAccessToken();
    if (accessToken) {
      return { accessToken, channelId, mode: "refresh" };
    }
    // Fall through to static access token if refresh failed.
  }

  const accessToken = env("YOUTUBE_ACCESS_TOKEN");
  if (accessToken) {
    return { accessToken, channelId, mode: "access_token" };
  }
  return null;
}

/** Sync check — true when either refresh trio or access token + channel look set. */
export function isYouTubeConfigured(): boolean {
  const status = getYouTubeCredentialStatus();
  return (
    status.status === "ready_refresh" || status.status === "ready_access_token"
  );
}

/** @deprecated Prefer resolveYouTubeConfig() which refreshes tokens. */
export function getYouTubeConfig(): YouTubeConfig | null {
  const channelId = env("YOUTUBE_CHANNEL_ID");
  const accessToken = env("YOUTUBE_ACCESS_TOKEN");
  if (accessToken && channelId) {
    return { accessToken, channelId, mode: "access_token" };
  }
  // Sync path cannot refresh — report configured if refresh trio is present
  // so UI/health can show ready; publish uses resolveYouTubeConfig.
  if (
    env("YOUTUBE_CLIENT_ID") &&
    env("YOUTUBE_CLIENT_SECRET") &&
    env("YOUTUBE_REFRESH_TOKEN") &&
    channelId
  ) {
    return { accessToken: "", channelId, mode: "refresh" };
  }
  return null;
}

export function youtubePublishablePlatforms(): SocialPlatform[] {
  return isYouTubeConfigured() ? ["youtube"] : [];
}

export function canPublishWithYouTube(platform: SocialPlatform): boolean {
  return platform === "youtube" && youtubePublishablePlatforms().includes("youtube");
}

export type YouTubePublishInput = {
  caption: string;
  videoUrl: string | null;
};

export type YouTubePublishResult = {
  externalPostId: string | null;
  error: string | null;
};

function splitYouTubeCaption(caption: string): {
  title: string;
  description: string;
} {
  const lines = caption
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = (lines[0] ?? "Event highlight").slice(0, 100);
  const description = (lines.length > 1 ? lines.slice(1).join("\n") : caption)
    .trim()
    .slice(0, 5000);
  return { title, description: description || title };
}

/**
 * Upload a video to YouTube via resumable upload.
 * Privacy defaults to unlisted (safer than public for first ship).
 */
export async function publishToYouTube(
  input: YouTubePublishInput,
): Promise<YouTubePublishResult> {
  const config = await resolveYouTubeConfig();
  if (!config?.accessToken) {
    return {
      externalPostId: null,
      error:
        "YouTube needs refresh-token OAuth (YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN + CHANNEL_ID) or YOUTUBE_ACCESS_TOKEN + YOUTUBE_CHANNEL_ID. Or upload in Studio and Mark posted.",
    };
  }

  if (!input.videoUrl?.trim()) {
    return {
      externalPostId: null,
      error: "YouTube drafts need a video attachment on the packet.",
    };
  }

  let videoBytes: Buffer;
  let contentType = "video/mp4";
  try {
    const response = await fetch(input.videoUrl, { redirect: "follow" });
    if (!response.ok) {
      return {
        externalPostId: null,
        error: `Could not download packet video (${response.status}).`,
      };
    }
    const headerType = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (headerType?.startsWith("video/")) contentType = headerType;
    videoBytes = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    return {
      externalPostId: null,
      error:
        err instanceof Error
          ? `Could not download packet video: ${err.message}`
          : "Could not download packet video.",
    };
  }

  if (videoBytes.length === 0) {
    return { externalPostId: null, error: "Packet video file is empty." };
  }
  // Soft guard — Vercel/serverless bodies; larger files should use Mark posted.
  if (videoBytes.length > 256 * 1024 * 1024) {
    return {
      externalPostId: null,
      error:
        "Video is larger than 256 MB for one-click upload. Upload in YouTube Studio, then Mark posted.",
    };
  }

  const { title, description } = splitYouTubeCaption(input.caption);
  const privacy =
    process.env.YOUTUBE_PRIVACY_STATUS?.trim().toLowerCase() === "public"
      ? "public"
      : process.env.YOUTUBE_PRIVACY_STATUS?.trim().toLowerCase() === "private"
        ? "private"
        : "unlisted";

  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(videoBytes.length),
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          categoryId: "22",
          channelId: config.channelId,
        },
        status: {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  );

  if (!initResponse.ok) {
    const text = await initResponse.text().catch(() => "");
    return {
      externalPostId: null,
      error: `YouTube upload init failed (${initResponse.status}): ${text.slice(0, 400) || initResponse.statusText}`,
    };
  }

  const uploadUrl = initResponse.headers.get("location");
  if (!uploadUrl) {
    return {
      externalPostId: null,
      error: "YouTube did not return a resumable upload URL.",
    };
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": contentType,
      "Content-Length": String(videoBytes.length),
    },
    body: new Uint8Array(videoBytes),
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    return {
      externalPostId: null,
      error: `YouTube upload failed (${uploadResponse.status}): ${text.slice(0, 400) || uploadResponse.statusText}`,
    };
  }

  const json = (await uploadResponse.json().catch(() => null)) as {
    id?: string;
  } | null;
  const id = json?.id?.trim() || null;
  if (!id) {
    return {
      externalPostId: null,
      error: "YouTube upload succeeded but no video id was returned.",
    };
  }

  return { externalPostId: id, error: null };
}
