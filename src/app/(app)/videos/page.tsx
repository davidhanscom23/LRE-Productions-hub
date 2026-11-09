import { redirect } from "next/navigation";
import { VideoArchivesClient } from "@/components/videos/video-archives-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { ArchiveVideoListItem } from "@/lib/types/video-archives";

export default async function VideosPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const canManage = profile.role === "admin" || profile.role === "trainer";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("archive_videos")
    .select(
      "id, title, description, thumbnail_url, category, year, presenter, topics, tags, published",
    )
    .order("year", { ascending: false })
    .order("category", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Video Archives needs a database update</p>
        <p className="mt-2">
          Run migration <code>108_video_archives.sql</code> in Supabase, then
          refresh.
        </p>
      </div>
    );
  }

  const videos = ((data ?? []) as (ArchiveVideoListItem & { published: boolean })[])
    .filter((v) => v.published || canManage)
    .map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      thumbnail_url: v.thumbnail_url,
      category: v.category,
      year: v.year,
      presenter: v.presenter,
      topics: v.topics ?? [],
      tags: v.tags ?? [],
    }));

  return <VideoArchivesClient videos={videos} canManage={canManage} />;
}
