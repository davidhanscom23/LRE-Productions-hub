export type VideoEmbedKind = "drive" | "youtube" | "vimeo" | "file";

export type VideoEmbed = {
  kind: VideoEmbedKind;
  embedUrl: string;
};

const DIRECT_VIDEO_EXT = /\.(mp4|webm|ogg|mov)(?:$|[?#])/i;

const IFRAME_ALLOW: Record<Exclude<VideoEmbedKind, "file">, string> = {
  drive: "autoplay; fullscreen",
  youtube:
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
  vimeo: "autoplay; fullscreen; picture-in-picture",
};

export function iframeAllowFor(kind: VideoEmbedKind): string | null {
  if (kind === "file") return null;
  return IFRAME_ALLOW[kind];
}

/**
 * Detect recognized video URLs and return an in-Hub embed target.
 * Unrecognized URLs return null (keep external Open).
 */
export function getVideoEmbed(url: string): VideoEmbed | null {
  const raw = url?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const path = parsed.pathname;

  const driveId = driveFileId(host, path, parsed.searchParams);
  if (driveId) {
    return {
      kind: "drive",
      embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
    };
  }

  const youtubeId = youtubeVideoId(host, path, parsed.searchParams);
  if (youtubeId) {
    return {
      kind: "youtube",
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
    };
  }

  const vimeoId = vimeoVideoId(host, path);
  if (vimeoId) {
    return {
      kind: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
    };
  }

  if (DIRECT_VIDEO_EXT.test(path) || DIRECT_VIDEO_EXT.test(raw)) {
    return { kind: "file", embedUrl: raw };
  }

  return null;
}

function driveFileId(
  host: string,
  path: string,
  searchParams: URLSearchParams,
): string | null {
  if (host === "drive.google.com" || host === "docs.google.com") {
    const fileMatch = path.match(/\/file\/d\/([^/]+)/);
    if (fileMatch?.[1]) return fileMatch[1];

    const docsMatch = path.match(/\/d\/([^/]+)/);
    if (docsMatch?.[1] && host === "docs.google.com") return docsMatch[1];

    const openId = searchParams.get("id");
    if (openId && (path === "/open" || path.startsWith("/open"))) {
      return openId;
    }
    if (openId && host === "drive.google.com") return openId;
  }
  return null;
}

function youtubeVideoId(
  host: string,
  path: string,
  searchParams: URLSearchParams,
): string | null {
  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0];
    return id || null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (path === "/watch" || path.startsWith("/watch")) {
      return searchParams.get("v");
    }
    const embed = path.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/);
    if (embed?.[1]) return embed[1];
  }

  return null;
}

function vimeoVideoId(host: string, path: string): string | null {
  if (host === "player.vimeo.com") {
    const match = path.match(/^\/video\/(\d+)/);
    return match?.[1] ?? null;
  }

  if (host === "vimeo.com") {
    // Prefer /video/{id}; otherwise a bare numeric path segment.
    const videoPath = path.match(/^\/video\/(\d+)/);
    if (videoPath?.[1]) return videoPath[1];
    const bare = path.match(/^\/(\d+)(?:\/|$)/);
    if (bare?.[1]) return bare[1];
  }

  return null;
}
