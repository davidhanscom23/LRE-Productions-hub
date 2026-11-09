import { redirect } from "next/navigation";
import { ClientReviewsPageClient } from "@/components/client-reviews/client-reviews-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGuestRole } from "@/lib/auth/guest";
import { loadClientReviews } from "@/lib/reviews/load-client-reviews";
import { createClient } from "@/lib/supabase/server";

export default async function ClientReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (isGuestRole(profile.role)) redirect("/");

  const params = await searchParams;
  const canViewAll = profile.role === "admin" || profile.role === "trainer";
  const staffFilter = canViewAll ? (params.staff?.trim() || null) : null;

  const supabase = await createClient();

  // Credits + milestones are handled by sheet sync / daily cron — do not
  // await write-heavy backfill on every page open (was blocking mobile TTFB).
  const loaded = await loadClientReviews(supabase, {
    viewerId: profile.id,
    viewerRole: profile.role,
    staffFilterId: staffFilter,
  });

  const milestoneFocusId = staffFilter ?? profile.id;
  const milestoneCount = loaded.countsByStaffId[milestoneFocusId] ?? 0;
  const milestoneName =
    milestoneFocusId === profile.id
      ? profile.full_name?.trim() || "You"
      : loaded.staffOptions.find((p) => p.id === milestoneFocusId)?.full_name?.trim() ||
        "Staff";

  return (
    <ClientReviewsPageClient
      reviews={loaded.reviews}
      staffOptions={loaded.staffOptions}
      countsByStaffId={loaded.countsByStaffId}
      canViewAll={canViewAll}
      canSync={profile.role === "admin"}
      selectedStaffId={staffFilter}
      focusCount={milestoneCount}
      focusName={milestoneName}
    />
  );
}
