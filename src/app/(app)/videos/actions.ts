"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { isZoomConfigured } from "@/lib/zoom/client";
import {
  importZoomRecordings,
  type ZoomImportResult,
} from "@/lib/zoom/import-recordings";

type Result = { error: string | null };

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    return { supabase, user: null, error: "Only admins and trainers can manage videos." };
  }
  return { supabase, user, error: null as string | null };
}

function parseList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}
function validUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function createVideoAction(
  formData: FormData,
): Promise<{ error: string | null; id?: string }> {
  const { supabase, user, error } = await requireManager();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = String(formData.get("title") ?? "").trim();
  const videoUrl = String(formData.get("video_url") ?? "").trim();
  if (!title) return { error: "Title is required." };
  if (!validUrl(videoUrl)) return { error: "Enter a valid video URL." };

  const yearNum = Number(formData.get("year") ?? 0);
  const { data, error: insertError } = await supabase
    .from("archive_videos")
    .insert({
      title,
      description: String(formData.get("description") ?? "").trim(),
      video_url: videoUrl,
      thumbnail_url: String(formData.get("thumbnail_url") ?? "").trim(),
      category: String(formData.get("category") ?? "General").trim() || "General",
      year: Number.isInteger(yearNum) && yearNum > 2000 ? yearNum : new Date().getFullYear(),
      presenter: String(formData.get("presenter") ?? "").trim(),
      topics: parseList(String(formData.get("topics") ?? "")),
      tags: parseList(String(formData.get("tags") ?? "")),
      zoom_recording_id: String(formData.get("zoom_recording_id") ?? "").trim(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  revalidatePath("/videos");
  return { error: null, id: data.id as string };
}

export async function updateVideoAction(
  id: string,
  formData: FormData,
): Promise<Result> {
  const { supabase, user, error } = await requireManager();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = String(formData.get("title") ?? "").trim();
  const videoUrl = String(formData.get("video_url") ?? "").trim();
  if (!title) return { error: "Title is required." };
  if (!validUrl(videoUrl)) return { error: "Enter a valid video URL." };
  const yearNum = Number(formData.get("year") ?? 0);

  const { error: updateError } = await supabase
    .from("archive_videos")
    .update({
      title,
      description: String(formData.get("description") ?? "").trim(),
      video_url: videoUrl,
      thumbnail_url: String(formData.get("thumbnail_url") ?? "").trim(),
      category: String(formData.get("category") ?? "General").trim() || "General",
      year: Number.isInteger(yearNum) && yearNum > 2000 ? yearNum : new Date().getFullYear(),
      presenter: String(formData.get("presenter") ?? "").trim(),
      topics: parseList(String(formData.get("topics") ?? "")),
      tags: parseList(String(formData.get("tags") ?? "")),
      zoom_recording_id: String(formData.get("zoom_recording_id") ?? "").trim(),
    })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/videos");
  revalidatePath(`/videos/${id}`);
  return { error: null };
}

export async function deleteVideoAction(id: string): Promise<Result> {
  const { supabase, user, error } = await requireManager();
  if (error || !user) return { error: error ?? "Unauthorized" };
  const { error: delError } = await supabase
    .from("archive_videos")
    .delete()
    .eq("id", id);
  if (delError) return { error: delError.message };
  revalidatePath("/videos");
  return { error: null };
}

/* ---------------- assets ---------------- */

export async function addVideoAssetAction(input: {
  videoId: string;
  title: string;
  url: string;
}): Promise<Result> {
  const { supabase, user, error } = await requireManager();
  if (error || !user) return { error: error ?? "Unauthorized" };
  const url = input.url.trim();
  if (!validUrl(url)) return { error: "Enter a valid URL (include https://)." };
  const { error: insertError } = await supabase
    .from("archive_video_assets")
    .insert({
      video_id: input.videoId,
      title: input.title.trim() || url,
      url,
      created_by: user.id,
    });
  if (insertError) return { error: insertError.message };
  revalidatePath(`/videos/${input.videoId}`);
  return { error: null };
}

export async function deleteVideoAssetAction(
  id: string,
  videoId: string,
): Promise<Result> {
  const { supabase, user, error } = await requireManager();
  if (error || !user) return { error: error ?? "Unauthorized" };
  const { error: delError } = await supabase
    .from("archive_video_assets")
    .delete()
    .eq("id", id);
  if (delError) return { error: delError.message };
  revalidatePath(`/videos/${videoId}`);
  return { error: null };
}

/** Admin: import recent Zoom cloud recordings into Video Archives. */
export async function importZoomRecordingsAction(
  days: number,
): Promise<{ error: string | null; result?: ZoomImportResult }> {
  const { supabase, user, error } = await requireManager();
  if (error || !user) return { error: error ?? "Unauthorized" };
  if (!isZoomConfigured()) {
    return {
      error:
        "Zoom isn’t configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_HOST_EMAIL, and add the cloud_recording:read:list_user_recordings:admin scope.",
    };
  }

  const result = await importZoomRecordings(supabase, {
    days,
    createdBy: user.id,
  });
  revalidatePath("/videos");
  return { error: result.error, result };
}

/** Start a forum discussion linked to this video. Any non-guest member. */
export async function addVideoToForumAction(
  videoId: string,
): Promise<{ error: string | null; threadId?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const supabase = await createClient();
  const { data: video } = await supabase
    .from("archive_videos")
    .select("id, title")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) return { error: "Video not found." };

  const url = `/videos/${videoId}`;
  const { data: thread, error: threadErr } = await supabase
    .from("forum_threads")
    .insert({
      title: String(video.title).slice(0, 200),
      body: `Discussion for the video "${video.title}". Watch it here: ${url}`,
      author_id: profile.id,
    })
    .select("id")
    .single();
  if (threadErr) return { error: threadErr.message };

  await supabase.from("forum_attachments").insert({
    thread_id: thread.id,
    title: `Video: ${video.title}`,
    url,
    created_by: profile.id,
  });
  await supabase
    .from("forum_follows")
    .insert({ thread_id: thread.id, user_id: profile.id });

  revalidatePath("/forum");
  return { error: null, threadId: thread.id as string };
}
