import Link from "next/link";
import { AwardHolderRow } from "@/components/points/monthly-award-badges";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGuestRole } from "@/lib/auth/guest";
import {
  getCurrentMonthlyAwards,
  getMonthlyAwardsHistory,
} from "@/lib/points/monthly-awards";
import { formatAwardPeriod, orderMonthlyAwards } from "@/lib/points/monthly-awards-types";
import { createClient } from "@/lib/supabase/server";
import { Trophy } from "lucide-react";
import { redirect } from "next/navigation";

export default async function WinnersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (isGuestRole(profile.role)) redirect("/");

  const supabase = await createClient();
  const [currentRaw, history] = await Promise.all([
    getCurrentMonthlyAwards(supabase),
    getMonthlyAwardsHistory(supabase),
  ]);

  const current = orderMonthlyAwards(currentRaw);
  const currentPeriod = current[0]?.period ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Hub points
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          <Trophy className="h-6 w-6 text-[var(--brand)]" />
          Winners Hall of Fame
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Monthly trophies for Overall Leader (highest total points) and Monthly
          MVP (most points earned that month). David is excluded from winning.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/points"
            className="font-medium text-[var(--brand)] hover:underline"
          >
            Hub points tips
          </Link>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Current winners
          {currentPeriod ? ` · ${formatAwardPeriod(currentPeriod)}` : ""}
        </h2>
        {current.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No monthly trophies yet. Awards run on the 1st of each month for the
            prior month.
          </p>
        ) : (
          <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
            {current.map((holder) => (
              <AwardHolderRow
                key={holder.id}
                holder={holder}
                showMetric
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No past periods yet.</p>
        ) : (
          history.map(({ period, awards }) => (
            <div
              key={period}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {formatAwardPeriod(period)}
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {orderMonthlyAwards(awards).map((holder) => (
                  <AwardHolderRow
                    key={holder.id}
                    holder={holder}
                    showMetric
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
