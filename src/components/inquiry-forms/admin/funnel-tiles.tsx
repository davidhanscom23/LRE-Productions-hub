import { formatCount, formatPercent, percentOf } from "./list-helpers";

export interface FunnelTilesProps {
  views: number;
  starts: number;
  completes: number;
  /** perStepReached[i] = submissions that reached step i (optional; bars are hidden without it). */
  perStepReached?: number[];
  /** Step names in form order, same length as perStepReached. */
  stepLabels?: string[];
  /** Shown above the tiles, e.g. "Last 30 days". */
  caption?: string;
}

/**
 * Funnel summary: views, starts, completes, conversion, and how far people got per step.
 * Every number is printed as text; the bars are decoration only.
 */
export function FunnelTiles({ views, starts, completes, perStepReached, stepLabels, caption }: FunnelTilesProps) {
  const startRate = percentOf(starts, views);
  const completeRate = percentOf(completes, starts);
  const conversion = percentOf(completes, views);
  const reached = perStepReached ?? [];
  const top = Math.max(reached[0] ?? 0, ...reached, 1);

  const tiles: { label: string; value: string; note: string }[] = [
    { label: "Views", value: formatCount(views), note: "times the form was opened" },
    {
      label: "Started",
      value: formatCount(starts),
      note: startRate === null ? "finished the first step" : `${formatPercent(startRate)} of views`,
    },
    {
      label: "Completed",
      value: formatCount(completes),
      note: completeRate === null ? "sent the whole form" : `${formatPercent(completeRate)} of starts`,
    },
    { label: "Conversion", value: formatPercent(conversion), note: "of views became inquiries" },
  ];

  return (
    <section aria-label="Form funnel" className="space-y-3">
      {caption ? <p className="text-sm font-medium text-[var(--muted)]">{caption}</p> : null}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <dt className="text-sm font-medium text-[var(--muted)]">{t.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">{t.value}</dd>
            <dd className="mt-0.5 text-xs text-[var(--muted)]">{t.note}</dd>
          </div>
        ))}
      </dl>

      {reached.length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">How far people got</h3>
          <p className="text-xs text-[var(--muted)]">Spam is left out. A person counts once for every step they reached.</p>
          <ol className="mt-3 space-y-2">
            {reached.map((count, i) => {
              const share = percentOf(count, reached[0] ?? 0);
              const width = Math.max(0, Math.min(100, (count / top) * 100));
              const name = stepLabels?.[i]?.trim() || `Step ${i + 1}`;
              return (
                <li key={i} className="grid grid-cols-[minmax(0,10rem)_1fr_6.5rem] items-center gap-3 text-sm">
                  <span className="block min-w-0 truncate text-[var(--foreground)]" title={name}>
                    {i + 1}. {name}
                  </span>
                  <span className="block h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${width}%` }} />
                  </span>
                  <span className="whitespace-nowrap text-right tabular-nums text-[var(--foreground)]">
                    {formatCount(count)}
                    {i > 0 && share !== null ? <span className="text-[var(--muted)]"> ({formatPercent(share)})</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

export default FunnelTiles;
