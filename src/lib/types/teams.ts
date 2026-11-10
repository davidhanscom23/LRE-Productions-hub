export const TEAM_DEPARTMENTS = ["Audiovisual"] as const;

export type TeamDepartment = (typeof TEAM_DEPARTMENTS)[number];

export type DepartmentLink = {
  id: string;
  department: TeamDepartment;
  title: string;
  url: string;
  description: string;
  created_at: string;
  created_by: string | null;
};

export type DepartmentVideo = {
  id: string;
  department: TeamDepartment;
  title: string;
  description: string;
  video_url: string;
  category: string;
  thumbnail_url: string;
  created_at: string;
  created_by: string | null;
};

export type DepartmentLinkInput = {
  department: TeamDepartment;
  title: string;
  url: string;
  description: string;
};

export type DepartmentVideoInput = {
  department: TeamDepartment;
  title: string;
  description: string;
  video_url: string;
  category: string;
  thumbnail_url: string;
};

export function youtubeIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "") || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveVideoThumbnail(
  video: Pick<DepartmentVideo, "thumbnail_url" | "video_url">,
): string | null {
  if (video.thumbnail_url?.trim()) return video.thumbnail_url.trim();
  const id = youtubeIdFromUrl(video.video_url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return null;
}

export function embedVideoUrl(url: string): string | null {
  const yt = youtubeIdFromUrl(url);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}
