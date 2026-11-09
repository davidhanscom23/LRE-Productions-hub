import Link from "next/link";
import { Cake } from "lucide-react";
import { colorSoftBackground, normalizeHexColor } from "@/lib/people/color";

export type HomeBirthdayItem = {
  id: string;
  name: string;
  label: string;
  daysUntil: number;
  avatarUrl: string | null;
  color: string | null;
};

type HomeBirthdaysStripProps = {
  items: HomeBirthdayItem[];
};

function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

export function HomeBirthdaysStrip({ items }: HomeBirthdaysStripProps) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Upcoming birthdays"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
          <Cake className="h-5 w-5 text-[var(--brand)]" />
          Upcoming birthdays
        </h2>
        <Link
          href="/people?tab=birthdays"
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          View all on People
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {items.map((item) => {
          const hex = normalizeHexColor(item.color);
          const initial = item.name.charAt(0).toUpperCase() || "?";
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold"
                style={
                  hex
                    ? {
                        backgroundColor: colorSoftBackground(hex, 0.22),
                        color: hex,
                        boxShadow: `0 0 0 2px ${hex}`,
                      }
                    : {
                        backgroundColor: "var(--brand-soft)",
                        color: "var(--brand)",
                      }
                }
                aria-hidden
              >
                {item.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar URL from profiles
                  <img
                    src={item.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {item.name}
                </p>
                <p className="text-xs text-[var(--muted)]">{item.label}</p>
              </div>
              <span
                className={[
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                  item.daysUntil === 0
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "bg-[var(--surface-hover)] text-[var(--muted)]",
                ].join(" ")}
              >
                {whenLabel(item.daysUntil)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
