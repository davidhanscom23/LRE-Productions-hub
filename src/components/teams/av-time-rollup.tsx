import { Users } from "lucide-react";
import {
  formatHoursMinutes,
  type AvTeamHoursRow,
  type AvTeamShiftRow,
} from "@/lib/teams/av-time-rollup";

type AvTimeRollupProps = {
  hours: AvTeamHoursRow[];
  recentShifts: AvTeamShiftRow[];
};

export function AvTimeRollup({ hours, recentShifts }: AvTimeRollupProps) {
  const totalMinutes = hours.reduce((sum, row) => sum + row.minutes, 0);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
          <Users className="h-3.5 w-3.5" />
          Team hours (last 7 days)
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {hours.length === 0
            ? "No closed AV shifts yet"
            : `${formatHoursMinutes(totalMinutes)} across ${hours.length} ${
                hours.length === 1 ? "person" : "people"
              }`}
        </p>
      </div>

      {hours.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          When AV staff clock out, their hours land here for admins and trainers.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {hours.map((row) => (
            <li
              key={row.userId}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--foreground)]">
                  {row.staffName}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {row.shiftCount === 1
                    ? "1 closed shift"
                    : `${row.shiftCount} closed shifts`}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-[var(--foreground)]">
                {formatHoursMinutes(row.minutes)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
          Recent team shifts
        </p>
        {recentShifts.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No AV shifts yet</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {recentShifts.map((shift) => (
              <li
                key={shift.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--foreground)]">
                    {shift.staffName}
                    <span className="font-normal text-[var(--muted)]">
                      {" "}
                      · {shift.eventName || "Untitled event"}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatRange(shift.clockedInAt, shift.clockedOutAt)}
                    {shift.source === "calendar" ? " · Calendar" : ""}
                  </p>
                </div>
                {shift.clockedOutAt ? (
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {formatHoursMinutes(
                      minutesClosed(shift.clockedInAt, shift.clockedOutAt),
                    )}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]">
                    Open
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function minutesClosed(start: string, end: string): number {
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000);
}

function formatRange(start: string, end: string | null) {
  const s = new Date(start);
  const startLabel = s.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end) return `Started ${startLabel}`;
  const e = new Date(end);
  return `${startLabel} – ${e.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
