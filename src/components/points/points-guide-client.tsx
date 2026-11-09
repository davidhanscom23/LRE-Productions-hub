"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Flame,
  Lightbulb,
  Lock,
  Medal,
  ScrollText,
  Trophy,
} from "lucide-react";
import type {
  HubLeaderboardEntry,
  HubMyPoints,
  HubPointEventRow,
} from "@/lib/points/hub-points";
import {
  CATEGORY_LABEL,
  DIFFICULTY_LABEL,
  POINTS_HINTS,
  type PointsHint,
} from "@/lib/points/hints";

export type PointsTab = "earn" | "standings" | "activity";

type PersonOption = { id: string; name: string };

type PointsGuideClientProps = {
  myPoints: HubMyPoints;
  unlockedKeys: string[];
  tab: PointsTab;
  canViewActivity: boolean;
  /** Admin/trainer: full team ledger + person filter. Staff: own only. */
  canViewTeamActivity?: boolean;
  standings: HubLeaderboardEntry[];
  /** Award-excluded score (David) shown as the mark to beat. */
  targetToBeat: HubLeaderboardEntry | null;
  activity: HubPointEventRow[];
  activityPage: number;
  activityHasMore: boolean;
  activityPersonId: string;
  people: PersonOption[];
};

const CATEGORY_ORDER: PointsHint["category"][] = [
  "daily",
  "discover",
  "learn",
  "field",
  "social",
  "easter",
];

const DIFFICULTY_TONE: Record<PointsHint["difficulty"], string> = {
  easy: "text-emerald-800 dark:text-emerald-200",
  medium: "text-sky-800 dark:text-sky-200",
  hard: "text-amber-800 dark:text-amber-200",
  legendary: "text-violet-800 dark:text-violet-200",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function hrefFor(tab: PointsTab, personId?: string, page?: number): string {
  const params = new URLSearchParams();
  if (tab !== "earn") params.set("tab", tab);
  if (tab === "activity" && personId) params.set("person", personId);
  if (tab === "activity" && page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/points?${qs}` : "/points";
}

export function PointsGuideClient({
  myPoints,
  unlockedKeys,
  tab,
  canViewActivity,
  canViewTeamActivity = false,
  standings,
  targetToBeat,
  activity,
  activityPage,
  activityHasMore,
  activityPersonId,
  people,
}: PointsGuideClientProps) {
  const router = useRouter();
  const unlocked = new Set(unlockedKeys);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Hub points
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          <Trophy className="h-6 w-6 text-[var(--brand)]" />
          Hub points
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your score, how to earn more, team standings, and your activity
          history
          {canViewTeamActivity ? " — plus the full team ledger for trainers and admins" : ""}
          .
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Your score
            </p>
            <p className="mt-1 text-3xl font-semibold text-[var(--foreground)]">
              {myPoints.points.toLocaleString()}{" "}
              <span className="text-base font-medium text-[var(--muted)]">
                pts
              </span>
            </p>
          </div>
          {myPoints.currentStreak > 0 ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
              <Flame className="h-4 w-4" />
              {myPoints.currentStreak}-day streak
              {myPoints.longestStreak > myPoints.currentStreak
                ? ` · best ${myPoints.longestStreak}`
                : null}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Open Home today to start a streak.
            </p>
          )}
        </div>
      </section>

      <nav
        className="flex flex-wrap gap-1 border-b border-[var(--border)]"
        aria-label="Hub points sections"
      >
        <TabLink active={tab === "earn"} href={hrefFor("earn")}>
          How to earn
        </TabLink>
        <TabLink active={tab === "standings"} href={hrefFor("standings")}>
          Standings
        </TabLink>
        {canViewActivity ? (
          <TabLink
            active={tab === "activity"}
            href={hrefFor("activity", activityPersonId || undefined)}
          >
            Activity
          </TabLink>
        ) : null}
      </nav>

      {tab === "earn" ? (
        <EarnTab unlocked={unlocked} />
      ) : null}

      {tab === "standings" ? (
        <StandingsTab standings={standings} targetToBeat={targetToBeat} />
      ) : null}

      {tab === "activity" && canViewActivity ? (
        <ActivityTab
          rows={activity}
          page={activityPage}
          hasMore={activityHasMore}
          personId={activityPersonId}
          people={canViewTeamActivity ? people : []}
          teamView={canViewTeamActivity}
          onPersonChange={(id) => {
            router.push(hrefFor("activity", id || undefined, 1));
          }}
        />
      ) : null}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand)] text-[var(--foreground)]"
          : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function EarnTab({ unlocked }: { unlocked: Set<string> }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Easy wins first, then harder streaks and rarer finds. Hidden eggs stay
        cryptic — the fun is figuring them out.
      </p>
      {CATEGORY_ORDER.map((category) => {
        const items = POINTS_HINTS.filter((h) => h.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
              <Lightbulb className="h-5 w-5 text-[var(--brand)]" />
              {CATEGORY_LABEL[category]}
            </h2>
            <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              {items.map((hint) => {
                const done = unlocked.has(hint.key);
                return (
                  <li
                    key={hint.key}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {done ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-label="Earned"
                          />
                        ) : (
                          <Lock
                            className="h-4 w-4 shrink-0 text-[var(--muted)]"
                            aria-label="Not earned yet"
                          />
                        )}
                        <p className="font-medium text-[var(--foreground)]">
                          {hint.title}
                        </p>
                        <span
                          className={[
                            "text-xs font-semibold",
                            DIFFICULTY_TONE[hint.difficulty],
                          ].join(" ")}
                        >
                          {DIFFICULTY_LABEL[hint.difficulty]} · {hint.points}{" "}
                          pts
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {hint.hint}
                      </p>
                    </div>
                    {hint.href && !done ? (
                      <Link
                        href={hint.href}
                        className="shrink-0 text-sm font-medium text-[var(--brand)] hover:underline"
                      >
                        Open
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-[var(--muted)]">
        Admins can also award bonus points from any teammate’s People card. The
        scrolling Home leaderboard is separate and always public.
      </p>
    </div>
  );
}

function StandingsTab({
  standings,
  targetToBeat,
}: {
  standings: HubLeaderboardEntry[];
  targetToBeat: HubLeaderboardEntry | null;
}) {
  const leader = standings[0] ?? null;
  const gap =
    targetToBeat && leader
      ? Math.max(0, targetToBeat.points - leader.points)
      : null;

  return (
    <section className="space-y-6">
      {targetToBeat ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
            <Trophy className="h-5 w-5 text-[var(--brand)]" />
            Mark to beat
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Not eligible for monthly trophies — the score for the team to chase.
          </p>
          <div className="rounded-2xl border border-[var(--brand)]/35 bg-[var(--brand-soft)]/40 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {targetToBeat.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={targetToBeat.avatarUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{
                      backgroundColor: targetToBeat.color || "var(--brand)",
                    }}
                    aria-hidden
                  >
                    {targetToBeat.fullName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--foreground)]">
                    {targetToBeat.fullName}
                  </p>
                  {targetToBeat.currentStreak > 0 ? (
                    <p className="text-xs text-[var(--muted)]">
                      {targetToBeat.currentStreak}-day streak
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="shrink-0 text-lg font-semibold text-[var(--foreground)]">
                {targetToBeat.points.toLocaleString()}{" "}
                <span className="text-sm font-medium text-[var(--muted)]">
                  pts
                </span>
              </p>
            </div>
            {gap != null && gap > 0 && leader ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Team lead ({leader.fullName}) is{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {gap.toLocaleString()} pts
                </span>{" "}
                behind — keep climbing.
              </p>
            ) : gap === 0 && leader ? (
              <p className="mt-3 text-sm font-medium text-[var(--brand)]">
                {leader.fullName} has caught the mark. Nice work.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
          <Medal className="h-5 w-5 text-[var(--brand)]" />
          Team standings
        </h2>
        {standings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No points yet — check in on Home to get on the board.
          </p>
        ) : (
          <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {standings.map((entry, index) => (
              <li
                key={entry.userId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 text-sm font-semibold text-[var(--muted)]">
                    {index + 1}
                  </span>
                  {entry.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.avatarUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{
                        backgroundColor: entry.color || "var(--brand)",
                      }}
                      aria-hidden
                    >
                      {entry.fullName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--foreground)]">
                      {entry.fullName}
                    </p>
                    {entry.currentStreak > 0 ? (
                      <p className="text-xs text-[var(--muted)]">
                        {entry.currentStreak}-day streak
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold text-[var(--foreground)]">
                  {entry.points.toLocaleString()}{" "}
                  <span className="font-medium text-[var(--muted)]">pts</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function ActivityTab({
  rows,
  page,
  hasMore,
  personId,
  people,
  teamView,
  onPersonChange,
}: {
  rows: HubPointEventRow[];
  page: number;
  hasMore: boolean;
  personId: string;
  people: PersonOption[];
  teamView: boolean;
  onPersonChange: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
            <ScrollText className="h-5 w-5 text-[var(--brand)]" />
            Activity
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {teamView
              ? "Who earned points and why — automatic awards and admin grants."
              : "Your Hub points awards — automatic and admin grants."}
          </p>
        </div>
        {teamView && people.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Person
            <select
              value={personId}
              onChange={(e) => onPersonChange(e.target.value)}
              className="h-9 min-w-[10rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
            >
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No activity yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--foreground)]">
                  {row.userName}
                </p>
                <p
                  className={[
                    "text-sm font-semibold",
                    row.points >= 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300",
                  ].join(" ")}
                >
                  {row.points > 0 ? "+" : ""}
                  {row.points.toLocaleString()} pts
                </p>
              </div>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{row.reason}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatWhen(row.createdAt)}
                {row.awardedByName
                  ? ` · awarded by ${row.awardedByName}`
                  : " · automatic"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 text-sm">
        {page > 1 ? (
          <Link
            href={hrefFor("activity", personId || undefined, page - 1)}
            className="font-medium text-[var(--brand)] hover:underline"
          >
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-[var(--muted)]">Page {page}</span>
        {hasMore ? (
          <Link
            href={hrefFor("activity", personId || undefined, page + 1)}
            className="font-medium text-[var(--brand)] hover:underline"
          >
            Next
          </Link>
        ) : (
          <span />
        )}
      </div>
    </section>
  );
}
