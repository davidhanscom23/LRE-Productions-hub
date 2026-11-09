import { PointsGuideClient, type PointsTab } from "@/components/points/points-guide-client";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  getMyPoints,
  getPointsActivityLog,
  getPointsLeaderboard,
  getPointsPeopleOptions,
  getPointsTargetToBeat,
} from "@/lib/points/hub-points";
import {
  canViewOwnPointsActivity,
  canViewTeamPointsActivity,
} from "@/lib/points/points-visibility";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function parseTab(
  raw: string | undefined,
  canViewActivity: boolean,
): PointsTab {
  if (raw === "standings") return "standings";
  if (raw === "activity" && canViewActivity) return "activity";
  return "earn";
}

export default async function PointsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; page?: string; person?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (isGuestRole(profile.role)) redirect("/");

  const params = (await searchParams) ?? {};
  const canViewActivity = canViewOwnPointsActivity(profile.role);
  const canViewTeamActivity = canViewTeamPointsActivity(profile.role);
  const tab = parseTab(params.tab, canViewActivity);
  const activityPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const activityPersonId = canViewTeamActivity
    ? (params.person ?? "").trim()
    : "";

  const supabase = await createClient();
  const myPoints = await getMyPoints(supabase, profile.id);
  const [standings, targetToBeat] = await Promise.all([
    getPointsLeaderboard(supabase, 50, { excludeAwardExcluded: true }),
    getPointsTargetToBeat(supabase),
  ]);

  const unlockedKeys = new Set<string>();

  const { data: unlockRows } = await supabase
    .from("hub_user_achievements")
    .select("achievement_id")
    .eq("user_id", profile.id);

  const achievementIds = (unlockRows ?? [])
    .map((row) => String(row.achievement_id ?? ""))
    .filter(Boolean);

  if (achievementIds.length) {
    const { data: achievements } = await supabase
      .from("hub_achievements")
      .select("key")
      .in("id", achievementIds);
    for (const row of achievements ?? []) {
      if (row.key) unlockedKeys.add(String(row.key));
    }
  }

  if (myPoints.lastCheckinDay) {
    const todayNy = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (myPoints.lastCheckinDay === todayNy) {
      unlockedKeys.add("daily_login");
    }
  }

  const streak = Math.max(myPoints.currentStreak, myPoints.longestStreak);
  if (streak >= 3) unlockedKeys.add("streak_3");
  if (streak >= 7) unlockedKeys.add("streak_7");
  if (streak >= 14) unlockedKeys.add("streak_14");
  if (streak >= 30) unlockedKeys.add("streak_30");
  if (streak >= 60) unlockedKeys.add("streak_60");
  if (streak >= 100) unlockedKeys.add("streak_100");

  let activity: Awaited<ReturnType<typeof getPointsActivityLog>> = {
    rows: [],
    page: activityPage,
    pageSize: 50,
    hasMore: false,
  };
  let people: { id: string; name: string }[] = [];

  const isAdmin = profile.role === "admin";

  if (canViewActivity && tab === "activity") {
    if (canViewTeamActivity) {
      [activity, people] = await Promise.all([
        getPointsActivityLog(supabase, {
          page: activityPage,
          personId: activityPersonId || null,
          includeHidden: isAdmin,
        }),
        getPointsPeopleOptions(supabase, { includeHidden: isAdmin }),
      ]);
    } else {
      activity = await getPointsActivityLog(supabase, {
        page: activityPage,
        onlyUserId: profile.id,
        includeHidden: true,
      });
    }
  }

  return (
    <PointsGuideClient
      myPoints={myPoints}
      unlockedKeys={[...unlockedKeys]}
      tab={tab}
      canViewActivity={canViewActivity}
      canViewTeamActivity={canViewTeamActivity}
      standings={standings}
      targetToBeat={targetToBeat}
      activity={activity.rows}
      activityPage={activity.page}
      activityHasMore={activity.hasMore}
      activityPersonId={activityPersonId}
      people={people}
    />
  );
}
