import { ScrollText } from "lucide-react";

/** Hub Health note — Activity privacy is fixed by role (no toggle). */
export function PointsActivityPrivacyCard() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
          <ScrollText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Hub points activity log
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            Role-based privacy
          </p>
          <p className="mt-1 max-w-xl text-xs text-[var(--muted)]">
            Staff see only their own Activity on Hub points. Trainers and admins
            see the full team ledger (David’s award-excluded entries stay
            admin-only). The Home leaderboard is unaffected.
          </p>
        </div>
      </div>
    </div>
  );
}
