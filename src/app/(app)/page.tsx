import { BusinessDetails } from "@/components/home/business-details";
import { CompanyFeed } from "@/components/home/company-feed";
import { AnnouncementsBanner } from "@/components/home/announcements-banner";
import { HomePoll } from "@/components/home/home-poll";
import type { Poll } from "@/lib/types/polls";
import {
  HomeActionCards,
  type HomeActionCard,
} from "@/components/home/home-action-cards";
import type { Announcement } from "@/lib/types/announcements";
import { HomeAnniversariesStrip } from "@/components/home/home-anniversaries-strip";
import { HomeBirthdaysStrip } from "@/components/home/home-birthdays-strip";
import { HomeWelcome } from "@/components/home/home-welcome";
import { HomePointsLeaderboard } from "@/components/points/home-points-leaderboard";
import { HomeMonthlyWinners } from "@/components/points/home-monthly-winners";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isSharedCalendarConfigured } from "@/lib/calendar/settings";
import {
  getMyPoints,
  getPointsLeaderboard,
} from "@/lib/points/hub-points";
import { getCurrentMonthlyAwards } from "@/lib/points/monthly-awards";
import { canViewStaffHandbook } from "@/lib/handbook/settings";
import { upcomingAnniversaries } from "@/lib/people/anniversaries";
import { upcomingBirthdays } from "@/lib/people/birthdays";
import { normalizeHexColor } from "@/lib/people/color";
import { canAccessAv } from "@/lib/av-access";
import { createClient } from "@/lib/supabase/server";
import { fetchCompanyWeather } from "@/lib/weather";
import {
  normalizeDepartments,
  type Profile,
} from "@/lib/types/database";
import {
  PROFILE_SAFE_COLUMNS,
  PROFILE_SAFE_COLUMNS_PRE_SOCIAL,
  PROFILE_SAFE_COLUMNS_PRE_THEME,
} from "@/lib/types/profile-columns";
import type { Post, PostAuthor, PostComment, PostKind } from "@/lib/types/posts";

type PostCommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: PostAuthor | PostAuthor[] | null;
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  kind?: string | null;
  subject_profile_id?: string | null;
  celebration_date?: string | null;
  author: PostAuthor | PostAuthor[] | null;
  comments?: PostCommentRow[] | null;
};

function mapProfiles(rows: Profile[] | null | undefined): Profile[] {
  return ((rows ?? []) as Profile[]).map((row) => ({
    ...row,
    departments: normalizeDepartments(
      (row as { departments?: unknown }).departments,
    ),
    color: normalizeHexColor((row as { color?: unknown }).color),
    facebook_url: row.facebook_url ?? null,
    instagram_url: row.instagram_url ?? null,
    linkedin_url: row.linkedin_url ?? null,
    twitter_url: row.twitter_url ?? null,
  }));
}

export default async function HomePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const guest = isGuestRole(profile?.role);
  const weather = await fetchCompanyWeather().catch(() => null);

  if (guest) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <HomeWelcome
          fullName={profile?.full_name ?? ""}
          email={profile?.email ?? ""}
          weather={weather}
          isGuest
        />
        <BusinessDetails />
      </div>
    );
  }

  // Auto-post today's birthday / anniversary celebrations (idempotent RPC).
  try {
    await supabase.rpc("ensure_today_celebration_posts");
  } catch {
    // Migration 083 may not be applied yet
  }

  const [
    postsResult,
    birthdayProfilesResult,
    anniversaryProfilesResult,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        `
      id,
      author_id,
      body,
      created_at,
      kind,
      subject_profile_id,
      celebration_date,
      author:profiles!posts_author_id_fkey (
        id,
        full_name,
        email,
        avatar_url,
        color
      ),
      comments:post_comments (
        id,
        post_id,
        author_id,
        body,
        created_at,
        author:profiles!post_comments_author_id_fkey (
          id,
          full_name,
          email,
          avatar_url,
          color
        )
      )
    `,
      )
      .order("created_at", { ascending: false })
      .order("created_at", {
        referencedTable: "post_comments",
        ascending: true,
      })
      .limit(40),
    supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS)
      .eq("is_active", true)
      .not("birthday", "is", null),
    supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS)
      .eq("is_active", true)
      .not("start_date", "is", null),
  ]);

  // Fallback if celebration/comment columns aren't migrated yet.
  let resolvedPostsResult: {
    data: PostRow[] | null;
    error: { message: string } | null;
  } = postsResult as {
    data: PostRow[] | null;
    error: { message: string } | null;
  };
  if (postsResult.error) {
    const basic = await supabase
      .from("posts")
      .select(
        `
      id,
      author_id,
      body,
      created_at,
      author:profiles!posts_author_id_fkey (
        id,
        full_name,
        email,
        avatar_url,
        color
      )
    `,
      )
      .order("created_at", { ascending: false })
      .limit(40);
    resolvedPostsResult = {
      data: (basic.data as PostRow[] | null) ?? null,
      error: basic.error,
    };
  }

  let birthdayRows = birthdayProfilesResult.data;
  if (birthdayProfilesResult.error) {
    const fallbackSocial = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS_PRE_SOCIAL)
      .eq("is_active", true)
      .not("birthday", "is", null);
    if (!fallbackSocial.error) {
      birthdayRows = fallbackSocial.data as typeof birthdayRows;
    } else {
      const fallback = await supabase
        .from("profiles")
        .select(PROFILE_SAFE_COLUMNS_PRE_THEME)
        .eq("is_active", true)
        .not("birthday", "is", null);
      birthdayRows = fallback.data as typeof birthdayRows;
    }
  }

  let anniversaryRows = anniversaryProfilesResult.data;
  if (anniversaryProfilesResult.error) {
    const fallbackSocial = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS_PRE_SOCIAL)
      .eq("is_active", true)
      .not("start_date", "is", null);
    if (!fallbackSocial.error) {
      anniversaryRows = fallbackSocial.data as typeof anniversaryRows;
    } else {
      const fallback = await supabase
        .from("profiles")
        .select(PROFILE_SAFE_COLUMNS_PRE_THEME)
        .eq("is_active", true)
        .not("start_date", "is", null);
      anniversaryRows = fallback.data as typeof anniversaryRows;
    }
  }

  const birthdayProfiles = mapProfiles(birthdayRows as Profile[] | null);
  const anniversaryProfiles = mapProfiles(
    anniversaryRows as Profile[] | null,
  );

  const upcomingBirthdaysList = upcomingBirthdays(
    birthdayProfiles,
    8,
    14,
  ).map((row) => ({
    id: row.profile.id,
    name: row.profile.full_name?.trim() || row.profile.email,
    label: row.label,
    daysUntil: row.daysUntil,
    avatarUrl: row.profile.avatar_url,
    color: row.profile.color,
  }));

  const upcomingAnniversariesList = upcomingAnniversaries(
    anniversaryProfiles,
    8,
    14,
  ).map((row) => ({
    id: row.profile.id,
    name: row.profile.full_name?.trim() || row.profile.email,
    label: row.label,
    yearsLabel: row.yearsLabel,
    daysUntil: row.daysUntil,
    avatarUrl: row.profile.avatar_url,
    color: row.profile.color,
  }));

  const { data: postRows, error } = resolvedPostsResult;

  function mapAuthor(
    author: PostAuthor | PostAuthor[] | null | undefined,
  ): PostAuthor | null {
    if (!author) return null;
    return Array.isArray(author) ? (author[0] ?? null) : author;
  }

  const posts: Post[] = ((postRows ?? []) as PostRow[]).map((row) => {
    const kindRaw = String(row.kind ?? "user");
    const kind: PostKind =
      kindRaw === "birthday" || kindRaw === "anniversary" ? kindRaw : "user";
    const comments: PostComment[] = (row.comments ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((c) => ({
        id: c.id,
        post_id: c.post_id,
        author_id: c.author_id,
        body: c.body,
        created_at: c.created_at,
        author: mapAuthor(c.author),
      }));

    return {
      id: row.id,
      author_id: row.author_id,
      body: row.body,
      created_at: row.created_at,
      author: mapAuthor(row.author),
      kind,
      subject_profile_id: row.subject_profile_id ?? null,
      celebration_date: row.celebration_date ?? null,
      comments,
    };
  });

  const role = profile?.role ?? null;
  const canPost =
    role === "admin" || role === "trainer" || role === "staff";
  const canComment = canPost;
  const isAdmin = role === "admin";
  /** Trainers/admins can delete own posts; staff can post but not delete. */
  const canDeleteOwnPosts = role === "admin" || role === "trainer";

  // "What needs you" — teaser into canonical For You inbox.
  const actionCards: HomeActionCard[] = [];
  let actionTotal = 0;
  try {
    if (profile && profile.role !== "guest") {
      const { getForYouQueue } = await import("@/lib/for-you/queue");
      const queue = await getForYouQueue(profile);
      actionTotal = queue.totalActionable;
      if (queue.totalActionable > 0) {
        for (const section of queue.sections
          .filter((s) => s.actionable !== false)
          .slice(0, 3)) {
          const count = section.items.length;
          actionCards.push({
            label: section.title,
            detail: count === 1 ? section.items[0]?.label : undefined,
            count,
            href: "/for-you",
            tone: section.tone,
            icon: "inbox",
          });
        }
      }
    }
  } catch {
    // non-critical — skip cards if a table/function isn't ready
  }

  // Admins: new venue quote requests waiting for a reply.
  if (profile?.role === "admin") {
    try {
      const { count } = await supabase
        .from("venue_portal_quote_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (count && count > 0) {
        actionCards.unshift({
          label: count === 1 ? "New venue quote request" : "New venue quote requests",
          detail: "Reply and update the status.",
          count,
          href: "/venue-quotes/requests",
          tone: "brand",
          icon: "venue",
        });
        actionTotal += count;
      }
    } catch {
      // table not created yet — skip
    }
  }
  const visibleActionCards = actionCards.slice(0, 3);

  // Active announcements for the Home banner
  let activeAnnouncements: Announcement[] = [];
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const { data: annRows } = await supabase
      .from("announcements")
      .select("*")
      .or(`expires_at.is.null,expires_at.gte.${todayKey}`)
      .order("created_at", { ascending: false })
      .limit(5);
    const anns = (annRows ?? []) as Announcement[];
    if (anns.length) {
      const { data: myAcks } = await supabase
        .from("announcement_acks")
        .select("announcement_id")
        .eq("user_id", profile?.id ?? "");
      const ackSet = new Set(
        (myAcks ?? []).map((r) => r.announcement_id as string),
      );
      activeAnnouncements = anns.map((a) => ({ ...a, acked: ackSet.has(a.id) }));
    }
  } catch {
    // non-critical
  }

  // Per-user Home shortcut tiles + access flags for the customize catalog.
  const showMarketing = role === "admin" || role === "trainer";
  const showHandbook = await canViewStaffHandbook(isAdmin);
  let pinnedHrefs: string[] | null = null;
  try {
    const { data: sc } = await supabase
      .from("home_shortcuts")
      .select("href")
      .eq("user_id", profile?.id ?? "")
      .order("sort_order", { ascending: true });
    if (sc && sc.length) pinnedHrefs = sc.map((r) => r.href as string);
  } catch {
    // non-critical — falls back to default tiles
  }

  // Latest open poll for the Home poll card.
  let homePoll: Poll | null = null;
  try {
    const { data: pollData } = await supabase.rpc("list_polls_with_results");
    const rows = (pollData ?? []) as Record<string, unknown>[];
    const open = rows.find((r) => !r.is_closed);
    if (open) {
      const opts = Array.isArray(open.options)
        ? (open.options as Record<string, unknown>[])
        : [];
      homePoll = {
        id: String(open.id),
        question: String(open.question ?? ""),
        is_closed: false,
        closes_at: (open.closes_at as string) ?? null,
        created_at: String(open.created_at ?? ""),
        created_by: String(open.created_by ?? ""),
        my_option_id: (open.my_option_id as string) ?? null,
        total_votes: Number(open.total_votes) || 0,
        options: opts.map((o) => ({
          id: String(o.id),
          label: String(o.label ?? ""),
          sort_order: Number(o.sort_order) || 0,
          votes: Number(o.votes) || 0,
        })),
      };
    }
  } catch {
    // non-critical
  }

  let monthlyWinners: Awaited<ReturnType<typeof getCurrentMonthlyAwards>> = [];
  try {
    monthlyWinners = await getCurrentMonthlyAwards(supabase);
  } catch {
    // Migration 079 may not be applied yet
  }

  const [pointsLeaderboard, myPoints] = await Promise.all([
    getPointsLeaderboard(supabase, 3, { excludeAwardExcluded: true }),
    profile?.id
      ? getMyPoints(supabase, profile.id)
      : Promise.resolve({
          points: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastCheckinDay: null,
        }),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <HomeWelcome
        fullName={profile?.full_name ?? ""}
        profileId={profile?.id ?? ""}
        email={profile?.email ?? ""}
        weather={weather}
        isAdmin={isAdmin}
        showCalendar={isAdmin || (await isSharedCalendarConfigured())}
        showAv={canAccessAv(profile)}
        showMarketing={showMarketing}
        showHandbook={showHandbook}
        pinnedHrefs={pinnedHrefs}
      />

      <HomePointsLeaderboard
        enabled
        initialLeaderboard={pointsLeaderboard}
        initialMyPoints={myPoints}
      />

      {!guest ? <HomeMonthlyWinners awards={monthlyWinners} /> : null}

      <AnnouncementsBanner announcements={activeAnnouncements} />

      <HomePoll poll={homePoll} />

      <HomeActionCards cards={visibleActionCards} total={actionTotal} />

      <HomeBirthdaysStrip items={upcomingBirthdaysList} />
      <HomeAnniversariesStrip items={upcomingAnniversariesList} />

      {error ? (
        <div className="rounded-[var(--panel-radius)] border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          Couldn’t load the feed: {error.message}
        </div>
      ) : (
        <CompanyFeed
          posts={posts}
          currentUserId={profile?.id ?? null}
          canPost={Boolean(canPost)}
          canComment={Boolean(canComment)}
          isAdmin={Boolean(isAdmin)}
          canDeleteOwnPosts={Boolean(canDeleteOwnPosts)}
        />
      )}

      <BusinessDetails />
    </div>
  );
}
