import { notFound, redirect } from "next/navigation";
import { VideoDetailView } from "@/components/videos/video-detail-view";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  ArchiveVideo,
  ArchiveVideoAsset,
  ArchiveVideoChat,
} from "@/lib/types/video-archives";

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");
  const canManage = profile.role === "admin" || profile.role === "trainer";

  const supabase = await createClient();
  const { data: video } = await supabase
    .from("archive_videos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!video) notFound();

  const [{ data: assetRows }, { data: chatRows }] = await Promise.all([
    supabase
      .from("archive_video_assets")
      .select("*")
      .eq("video_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("archive_video_chat")
      .select("*")
      .eq("video_id", id)
      .order("ts_seconds", { ascending: true }),
  ]);

  return (
    <VideoDetailView
      video={video as ArchiveVideo}
      assets={(assetRows ?? []) as ArchiveVideoAsset[]}
      chat={(chatRows ?? []) as ArchiveVideoChat[]}
      canManage={canManage}
    />
  );
}
