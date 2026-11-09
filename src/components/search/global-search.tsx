"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  searchHubAction,
  type SearchHit,
} from "@/app/(app)/search/actions";

const GROUP_LABELS: Record<SearchHit["group"], string> = {
  pages: "Pages",
  people: "People",
  resources: "Resources",
  packets: "Event Packets",
  courses: "Courses",
};

const GROUP_ORDER: SearchHit["group"][] = [
  "pages",
  "people",
  "packets",
  "courses",
  "resources",
];

export function GlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchHubAction(trimmed);
        if (result.error) {
          setError(result.error);
          setHits([]);
          return;
        }
        setError(null);
        setHits(result.hits);
        setActiveIndex(0);
        setOpen(true);
      });
    }, 220);

    return () => window.clearTimeout(handle);
  }, [query]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: hits.filter((hit) => hit.group === group),
    })).filter((entry) => entry.items.length > 0);
  }, [hits]);

  const flat = useMemo(
    () => grouped.flatMap((entry) => entry.items),
    [grouped],
  );

  function goTo(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      if (query.trim().length >= 2) setOpen(true);
    }
    if (!flat.length) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = flat[activeIndex];
      if (hit) goTo(hit);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          if (value.trim().length < 2) {
            setHits([]);
            setError(null);
          }
        }}
        onFocus={() => {
          if (query.trim().length >= 2) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search people, packets, courses…"
        className="h-10 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)] sm:h-9 sm:text-sm"
        aria-label="Global search"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        autoComplete="off"
      />

      {showPanel ? (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 z-50 mt-2 max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg sm:right-auto sm:w-[min(28rem,100%)]"
        >
          {pending && hits.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[var(--muted)]">Searching…</p>
          ) : error ? (
            <p className="px-3 py-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : flat.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[var(--muted)]">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {grouped.map((entry) => (
                <li key={entry.group}>
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    {GROUP_LABELS[entry.group]}
                  </p>
                  <ul>
                    {entry.items.map((hit) => {
                      const index = flat.findIndex((item) => item.id === hit.id);
                      const active = index === activeIndex;
                      return (
                        <li key={hit.id}>
                          <Link
                            href={hit.href}
                            onClick={() => {
                              setOpen(false);
                              setQuery("");
                            }}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={[
                              "block px-3 py-2",
                              active
                                ? "bg-[var(--brand-soft)] text-[var(--foreground)]"
                                : "hover:bg-[var(--surface-hover)]",
                            ].join(" ")}
                          >
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {hit.title}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {hit.subtitle}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
