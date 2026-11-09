import { MarketingLibraryClient } from "@/components/marketing-library/marketing-library-client";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  MarketingLink,
  MarketingVideo,
} from "@/lib/types/marketing-library";

export default async function MarketingLibraryPage() {
  const supabase = await createClient();
  const current = await getCurrentProfile();
  const guest = isGuestRole(current?.role);
  const canManage =
    !guest && (current?.role === "admin" || current?.role === "trainer");

  const [linksRes, videosRes] = await Promise.all([
    supabase
      .from("marketing_links")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("marketing_videos")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (linksRes.error || videosRes.error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Marketing Library needs a database update</p>
        <p className="mt-2">
          Run migration <code>099_marketing_library.sql</code> in Supabase, then
          refresh.
        </p>
      </div>
    );
  }

  const links = (linksRes.data ?? []) as MarketingLink[];
  const videos = (videosRes.data ?? []) as MarketingVideo[];

  return (
    <MarketingLibraryClient
      reviewLinks={links.filter((l) => l.section === "reviews")}
      photoLinks={links.filter((l) => l.section === "photos")}
      videos={videos}
      canManage={canManage}
    />
  );
}
