import Link from "next/link";
import { AwardHolderRow } from "@/components/points/monthly-award-badges";
import {
  formatAwardPeriod,
  orderMonthlyAwards,
  type MonthlyAwardHolder,
} from "@/lib/points/monthly-awards-types";

type HomeMonthlyWinnersProps = {
  awards: MonthlyAwardHolder[];
};

export function HomeMonthlyWinners({ awards }: HomeMonthlyWinnersProps) {
  if (!awards.length) return null;
  const ordered = orderMonthlyAwards(awards);
  const period = ordered[0]?.period;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
            Winners of the Month
          </p>
          <h2 className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            {period ? formatAwardPeriod(period) : "Latest trophies"}
          </h2>
        </div>
        <Link
          href="/winners"
          className="text-xs font-medium text-[var(--brand)] hover:underline"
        >
          Hall of Fame
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ordered.map((holder) => (
          <AwardHolderRow key={holder.id} holder={holder} />
        ))}
      </div>
    </section>
  );
}
