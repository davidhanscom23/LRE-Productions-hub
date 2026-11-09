import { COMPANY } from "@/lib/company";

export function MottoBar({ holidayTagline }: { holidayTagline?: string | null }) {
  return (
    <div className="hub-motto-bar shrink-0 bg-[var(--banner)] px-4 py-2.5 text-center">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--banner-fg)] uppercase sm:text-xs">
        {holidayTagline ?? COMPANY.tagline}
      </p>
    </div>
  );
}
