import Link from "next/link";
import { ArrowRight, Building2, Inbox } from "lucide-react";

export type HomeActionCard = {
  label: string;
  href: string;
  tone: "amber" | "brand";
  /** Big number on the card (items waiting). */
  count?: number;
  /** One short line under the label. */
  detail?: string;
  icon?: "venue" | "inbox";
};

/**
 * "Needs your attention" row on the Home page: a few count cards that link to
 * where the work is, plus a link to the full For You inbox. Renders nothing
 * when empty.
 */
export function HomeActionCards({
  cards,
  total = 0,
}: {
  cards: HomeActionCard[];
  total?: number;
}) {
  if (!cards.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
          Needs your attention
        </h2>
        {total > 0 ? (
          <Link
            href="/for-you"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
          >
            View all ({total}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon === "venue" ? Building2 : Inbox;
          const amber = card.tone === "amber";
          return (
            <Link
              key={`${card.href}-${card.label}`}
              href={card.href}
              className={[
                "group flex flex-col gap-3 rounded-[var(--panel-radius)] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                amber
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 opacity-80" />
                {typeof card.count === "number" ? (
                  <span className="text-3xl leading-none font-bold">{card.count}</span>
                ) : (
                  <ArrowRight className="h-4 w-4 opacity-80" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">{card.label}</p>
                {card.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{card.detail}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
