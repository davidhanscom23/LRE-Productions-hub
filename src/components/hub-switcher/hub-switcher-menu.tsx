"use client";

import { LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HubTile } from "@/lib/hub-switcher/tiles";

function Logo({ tile }: { tile: HubTile }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-lg font-semibold text-[var(--brand)]">
        {tile.name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tile.logoUrl} alt="" className="max-h-12 w-full object-contain dark:hidden" onError={() => setBroken(true)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tile.logoDarkUrl} alt="" className="hidden max-h-12 w-full object-contain dark:block" onError={() => setBroken(true)} />
    </>
  );
}

export function HubSwitcherMenu({ tiles }: { tiles: HubTile[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      } else if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch hub"
        aria-expanded={open}
        title="Switch hub"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Switch hub</p>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => {
              const base =
                "flex h-24 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-center text-[11px] font-medium";
              if (t.current)
                return (
                  <div key={t.slug} className={`${base} border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--foreground)]`} aria-current="true">
                    <Logo tile={t} />
                    <span>You are here</span>
                  </div>
                );
              if (t.comingSoon)
                return (
                  <div key={t.slug} className={`${base} border-dashed border-[var(--border)] text-[var(--muted)] opacity-70`}>
                    <Logo tile={t} />
                    <span>Coming soon</span>
                  </div>
                );
              return (
                <a
                  key={t.slug}
                  href={t.url}
                  title={`Open ${t.name}`}
                  className={`${base} border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]`}
                >
                  <Logo tile={t} />
                  <span>{t.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
