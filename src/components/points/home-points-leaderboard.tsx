"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flame, Trophy } from "lucide-react";
import { dailyCheckinAction } from "@/app/(app)/points/actions";
import type { HubLeaderboardEntry, HubMyPoints } from "@/lib/points/hub-points";
import { colorSoftBackground, normalizeHexColor } from "@/lib/people/color";

type HomePointsLeaderboardProps = {
  initialLeaderboard: HubLeaderboardEntry[];
  initialMyPoints: HubMyPoints;
  enabled: boolean;
};

export function HomePointsLeaderboard({
  initialLeaderboard,
  initialMyPoints,
  enabled,
}: HomePointsLeaderboardProps) {
  const [leaderboard] = useState<HubLeaderboardEntry[]>(initialLeaderboard);
  const [myPoints, setMyPoints] = useState<HubMyPoints>(initialMyPoints);
  const [toast, setToast] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;
    void (async () => {
      const result = await dailyCheckinAction();
      if (!result.ok) return;
      setMyPoints((prev) => ({
        ...prev,
        points: result.points || prev.points,
        currentStreak: result.streak || prev.currentStreak,
        longestStreak: Math.max(prev.longestStreak, result.streak || 0),
      }));
      if (!result.already && result.awarded.length > 0) {
        const bits = result.awarded
          .filter((a) => a.awarded)
          .map((a) => `+${a.points} ${a.title ?? "points"}`);
        if (bits.length) {
          setToast(bits.join(" · "));
          window.setTimeout(() => setToast(null), 6000);
        }
      }
    })();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <section
      aria-label="Hub points leaderboard"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
          <Trophy className="h-5 w-5 text-[var(--brand)]" />
          Hub points
        </h2>
        <p className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          <span>
            You:{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {myPoints.points.toLocaleString()} pts
            </span>
          </span>
          {myPoints.currentStreak > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <Flame className="h-3.5 w-3.5" />
              {myPoints.currentStreak}-day streak
            </span>
          ) : null}
          <Link
            href="/points"
            className="font-medium text-[var(--brand)] hover:underline"
          >
            How to earn more
          </Link>
        </p>
      </div>

      {toast ? (
        <p className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {toast}
        </p>
      ) : null}

      {leaderboard.length > 0 ? (
        <div className="relative mt-3 overflow-hidden">
          <div className="hub-points-marquee flex w-max gap-8 pr-8">
            {[...leaderboard, ...leaderboard].map((entry, index) => {
              const color = normalizeHexColor(entry.color);
              const rank = (index % leaderboard.length) + 1;
              return (
                <div
                  key={`${entry.userId}-${index}`}
                  className="flex items-center gap-3 whitespace-nowrap"
                >
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    #{rank}
                  </span>
                  <span
                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-[var(--foreground)]"
                    style={{
                      background: color
                        ? colorSoftBackground(color)
                        : "var(--brand-soft)",
                    }}
                  >
                    {entry.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      entry.fullName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {entry.fullName}
                  </span>
                  <span className="text-sm text-[var(--muted)]">
                    {entry.points.toLocaleString()} pts
                  </span>
                  {entry.currentStreak > 0 ? (
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      🔥 {entry.currentStreak}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Explore the Hub and check in daily to climb the board. Top three
          scroll here once teammates earn points.{" "}
          <Link
            href="/points"
            className="font-medium text-[var(--brand)] hover:underline"
          >
            See how to earn more
          </Link>
          .
        </p>
      )}
    </section>
  );
}
