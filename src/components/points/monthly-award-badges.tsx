"use client";

import {
  AWARD_TYPE_LABEL,
  formatAwardPeriod,
  type MonthlyAwardHolder,
  type MonthlyAwardType,
  type PersonAwardSummary,
} from "@/lib/points/monthly-awards-types";
import { Medal, Trophy } from "lucide-react";

export function AwardIcon({
  type,
  className,
}: {
  type: MonthlyAwardType;
  className?: string;
}) {
  if (type === "overall_leader") {
    return <Trophy className={className ?? "h-4 w-4"} aria-hidden />;
  }
  return <Medal className={className ?? "h-4 w-4"} aria-hidden />;
}

export function AwardChip({
  type,
  period,
  compact = false,
}: {
  type: MonthlyAwardType;
  period: string | null;
  compact?: boolean;
}) {
  const gold = type === "overall_leader";
  const label = period
    ? `${AWARD_TYPE_LABEL[type]} · ${formatAwardPeriod(period)}`
    : AWARD_TYPE_LABEL[type];
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        gold
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
          : "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
        compact ? "max-w-[11rem] truncate" : "",
      ].join(" ")}
      title={label}
    >
      <AwardIcon type={type} className="h-3 w-3 shrink-0" />
      {compact ? AWARD_TYPE_LABEL[type] : label}
    </span>
  );
}

export function PersonAwardBadges({
  summary,
}: {
  summary: PersonAwardSummary | null | undefined;
}) {
  const chips: React.ReactNode[] = [];
  if (summary?.currentOverall) {
    chips.push(
      <AwardChip
        key="overall"
        type="overall_leader"
        period={summary.currentPeriod}
        compact
      />,
    );
  }
  if (summary?.currentMvp) {
    chips.push(
      <AwardChip
        key="mvp"
        type="monthly_mvp"
        period={summary.currentPeriod}
        compact
      />,
    );
  }
  if (summary && summary.totalWins > 0) {
    chips.push(
      <span
        key="wins"
        className="inline-flex items-center rounded-md bg-[var(--background)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted)]"
        title="Career monthly trophies"
      >
        {summary.totalWins} win{summary.totalWins === 1 ? "" : "s"}
      </span>,
    );
  }
  if (!chips.length) return null;
  return <span className="flex flex-wrap gap-1">{chips}</span>;
}

export function AwardHolderRow({
  holder,
  showMetric = false,
}: {
  holder: MonthlyAwardHolder;
  showMetric?: boolean;
}) {
  const gold = holder.awardType === "overall_leader";
  return (
    <div className="flex items-center gap-3">
      <span
        className={[
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          gold
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
            : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
        ].join(" ")}
      >
        <AwardIcon type={holder.awardType} className="h-4 w-4" />
      </span>
      {holder.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={holder.avatarUrl}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: holder.color || "var(--brand)" }}
        >
          {holder.fullName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">
          {holder.fullName}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {AWARD_TYPE_LABEL[holder.awardType]}
          {showMetric
            ? ` · ${holder.metricValue.toLocaleString()} pts`
            : null}
        </p>
      </div>
    </div>
  );
}
