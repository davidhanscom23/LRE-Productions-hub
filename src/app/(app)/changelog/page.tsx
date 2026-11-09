import { redirect } from "next/navigation";
import { ChangelogView } from "@/components/changelog/changelog-view";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  canSeeChangelogVideo,
  type ChangelogVideo,
} from "@/lib/changelog-videos/visibility";

export const metadata = { title: "What's New" };
export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  // Monthly "What's New" videos sit directly above that month's entries.
  // Row level security already hides what this person may not see; the filter
  // keeps an admin using "View as staff" on the staff view.
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("changelog_videos")
    .select(
      "id, title, kind, audience, period_start, period_end, src, topic_keys, summary, status, superseded_by, created_at",
    )
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false });
  const videos = ((rows ?? []) as ChangelogVideo[]).filter((v) =>
    canSeeChangelogVideo(v, profile),
  );

  return <ChangelogView videos={videos} />;
}
