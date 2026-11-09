"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setHolidayPreviewAction } from "@/app/(app)/hub-health/holiday-preview-actions";
import {
  HOLIDAY_IDS,
  HOLIDAY_THEMES,
  type HolidayId,
} from "@/lib/holidays/holidays";

type Props = {
  /** Holiday currently being previewed (null = off). */
  current: HolidayId | null;
};

/** Admin control — preview any holiday theme on any day. */
export function HolidayPreviewCard({ current }: Props) {
  const [active, setActive] = useState<HolidayId | null>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: HolidayId | null) {
    const previous = active;
    setError(null);
    setActive(next);
    startTransition(async () => {
      const result = await setHolidayPreviewAction(next);
      if (result.error) {
        setActive(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Holiday themes
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            Preview any holiday theme (admins only)
          </p>
          <p className="mt-1 max-w-xl text-xs text-[var(--muted)]">
            Pick a holiday to dress the whole Hub in it for your admin session.
            Staff and trainers never see the preview; they only get the real
            holiday on the real day. Turn the preview off when you&apos;re
            done.
          </p>
        </div>
        <button
          type="button"
          disabled={pending || !active}
          onClick={() => choose(null)}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Turn preview off
        </button>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {HOLIDAY_IDS.map((id) => {
          const theme = HOLIDAY_THEMES[id];
          const selected = active === id;
          return (
            <li key={id}>
              <button
                type="button"
                disabled={pending}
                aria-pressed={selected}
                onClick={() => choose(selected ? null : id)}
                className={[
                  "group block w-full overflow-hidden rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
                  selected
                    ? "border-[var(--brand)] ring-2 ring-[var(--brand)]"
                    : "border-[var(--border)] hover:border-[var(--muted)]",
                  pending ? "opacity-70" : "",
                ].join(" ")}
              >
                <span
                  className="block aspect-video w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(/holidays/${id}.jpg)` }}
                  aria-hidden
                />
                <span className="block px-3 py-2">
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    {theme.name}
                  </span>
                  <span className="block text-[11px] text-[var(--muted)]">
                    {selected ? "Previewing now" : theme.rule}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      {active ? (
        <p className="mt-3 text-xs font-medium text-[var(--foreground)]">
          Previewing {HOLIDAY_THEMES[active].name} for your admin session.{" "}
          <Link href="/" className="underline underline-offset-2">
            Open Home
          </Link>{" "}
          to see the theme, greeting and splash (add ?holidayPopup=1 to replay
          the splash).
        </p>
      ) : null}
    </div>
  );
}
