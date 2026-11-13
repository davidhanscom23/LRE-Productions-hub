"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayCircle, Search, Sparkles } from "lucide-react";
import { HowToVideoDialog } from "@/components/how-to/how-to-video-dialog";
import { howToVideoForPath, type HowToVideo } from "@/lib/how-to/videos";
import type { Profile } from "@/lib/types/database";
import {
  NAV_GROUPS,
  filterItem,
  type NavItem,
} from "@/components/layout/sidebar";
import { shortcutStyle } from "@/components/home/home-welcome";
import {
  EXTRA_DESCRIPTIONS,
  TOOLS_SEEN_KEY,
  TOOL_CATEGORIES,
  isToolNew,
  toolMatchesQuery,
  type ToolsCategoryId,
} from "@/lib/tools/catalog";

type ToolsGroup = {
  id: ToolsCategoryId | "more";
  title: string;
  hue: number;
  tools: NavItem[];
};
import {
  DEFAULT_SHORTCUT_HREFS,
  SHORTCUT_DEFS,
  isShortcutAccessible,
} from "@/lib/home/shortcuts";

export type ToolsAccess = {
  isGuest: boolean;
  isAdmin: boolean;
  showCalendar: boolean;
  showAv: boolean;
  showHandbook: boolean;
  showMarketing: boolean;
};

const SHORTCUT_BY_HREF = new Map(SHORTCUT_DEFS.map((d) => [d.href, d]));

function describe(href: string): string {
  return (
    SHORTCUT_BY_HREF.get(href)?.description ?? EXTRA_DESCRIPTIONS[href] ?? ""
  );
}

function tint(hue: number) {
  return {
    backgroundColor: `hsl(${hue} 70% 55% / 0.16)`,
    color: `hsl(${hue} 62% 52%)`,
  };
}

export function ToolsLauncher({
  access,
  pinnedHrefs,
  profile,
}: {
  access: ToolsAccess;
  pinnedHrefs: string[] | null;
  profile?: Pick<Profile, "role" | "departments"> | null;
}) {
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<HowToVideo | null>(null);
  const [newHrefs, setNewHrefs] = useState<Set<string>>(new Set());

  // Tag tools that are new and that this device has not opened yet. Runs after
  // mount so the server and browser render the same HTML.
  useEffect(() => {
    const check = () => {
      try {
        const raw = window.localStorage.getItem(TOOLS_SEEN_KEY);
        const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
        const now = new Date();
        setNewHrefs(
          new Set(
            NAV_GROUPS.flatMap((g) => g.items)
              .map((i) => i.href)
              .filter(
                (h) =>
                  isToolNew(h, { now }) && !seen.has(h),
              ),
          ),
        );
      } catch {
        setNewHrefs(new Set());
      }
    };
    check();
  }, []);

  const markSeen = (href: string) => {
    try {
      const raw = window.localStorage.getItem(TOOLS_SEEN_KEY);
      const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      seen.add(href);
      window.localStorage.setItem(TOOLS_SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // the tag just stays until it expires
    }
  };

  const items = useMemo(() => {
    const all = NAV_GROUPS.flatMap((g) => g.items).filter((i) =>
      filterItem(i, access),
    );
    const seen = new Set<string>();
    return all.filter((i) => {
      if (i.href === "/" || seen.has(i.href)) return false;
      seen.add(i.href);
      return true;
    });
  }, [access]);

  const byHref = useMemo(() => new Map(items.map((i) => [i.href, i])), [items]);

  const groups = useMemo(() => {
    const used = new Set<string>();
    const out: ToolsGroup[] = TOOL_CATEGORIES.map((c) => {
      const tools = items.filter((i) => {
        if (i.toolsCategory !== c.id) return false;
        return toolMatchesQuery(i.label, i.href, describe(i.href), query);
      });
      tools.forEach((t) => used.add(t.href));
      return { id: c.id, title: c.title, hue: c.hue, tools };
    }).filter((g) => g.tools.length > 0);
    const rest = items.filter((i) => {
      if (used.has(i.href) || i.toolsCategory) return false;
      return toolMatchesQuery(i.label, i.href, describe(i.href), query);
    });
    if (rest.length) {
      out.push({ id: "more", title: "MORE", hue: 215, tools: rest });
    }
    return out;
  }, [items, query]);

  const matchCount = useMemo(
    () => groups.reduce((n, g) => n + g.tools.length, 0),
    [groups],
  );

  const quick = useMemo(() => {
    const chosen = pinnedHrefs ?? DEFAULT_SHORTCUT_HREFS;
    const ok = (href: string) => {
      const def = SHORTCUT_BY_HREF.get(href);
      return def ? isShortcutAccessible(def.gate, access) : false;
    };
    return chosen
      .filter(ok)
      .slice(0, 8)
      .map((href) => ({
        href,
        label: SHORTCUT_BY_HREF.get(href)!.label,
        Icon: byHref.get(href)?.icon ?? Sparkles,
      }));
  }, [pinnedHrefs, access, byHref]);

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <section className="bg-[var(--banner)] px-6 py-8 text-[var(--banner-fg)] sm:px-8">
        <p className="text-xs font-semibold tracking-[0.28em] text-[var(--brand)]">
          THE LRE HUB
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-wide sm:text-5xl">
          TOOLS
        </h1>

        <label className="relative mt-6 block max-w-xl">
          <span className="sr-only">Search tools</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--banner-fg)]/55" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools — quotes, warehouse, points…"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-3 text-sm text-[var(--banner-fg)] placeholder:text-[var(--banner-fg)]/45 outline-none ring-[var(--brand)] focus:ring-2"
          />
        </label>
        {query.trim() ? (
          <p className="mt-2 text-xs opacity-70">
            {matchCount === 0
              ? `No tools match “${query.trim()}”.`
              : `${matchCount} ${matchCount === 1 ? "tool" : "tools"} match “${query.trim()}”.`}
          </p>
        ) : null}

        {!access.isGuest && quick.length > 0 && !query.trim() ? (
          <>
            <p className="mt-7 text-xs font-semibold tracking-[0.22em] opacity-70">
              MY QUICK TOOLS
            </p>
            <div className="mt-3 flex flex-wrap gap-5">
              {quick.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex w-[5.5rem] flex-col items-center gap-2 text-center text-xs font-medium"
                >
                  <span
                    className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.25rem] border border-white/10 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"
                    style={shortcutStyle(href)}
                  >
                    <Icon className="h-8 w-8" />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-[11px] opacity-60">
              Change these with Customize on the Home page.
            </p>
          </>
        ) : null}
      </section>

      <section className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
        {groups.length === 0 ? (
          <p className="text-sm text-[var(--muted)] lg:col-span-2">
            Try another word, or clear the search to see every tool you can
            open.
          </p>
        ) : (
          groups.map((g) => (
            <div
              key={g.id}
              className="rounded-[var(--panel-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
            >
              <div className="mb-4 flex items-baseline justify-between">
                <h2
                  className="text-xs font-bold tracking-[0.2em]"
                  style={{ color: `hsl(${g.hue} 62% 52%)` }}
                >
                  {g.title}
                </h2>
                <span className="text-xs text-[var(--muted)]">
                  {g.tools.length} {g.tools.length === 1 ? "tool" : "tools"}
                </span>
              </div>
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                {g.tools.map((t) => {
                  const Icon = t.icon;
                  const desc = describe(t.href);
                  const video = howToVideoForPath(t.href, profile);
                  return (
                    <div key={t.href}>
                      <Link
                        href={t.href}
                        onClick={() => markSeen(t.href)}
                        className="group flex items-start gap-3 rounded-lg"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                          style={tint(g.hue)}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--brand)]">
                            {t.label}
                            {newHrefs.has(t.href) ? (
                              <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[9px] leading-none font-bold tracking-wide text-white">
                                NEW
                              </span>
                            ) : null}
                          </span>
                          {desc ? (
                            <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">
                              {desc}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                      {video ? (
                        <button
                          type="button"
                          onClick={() => setPlaying(video)}
                          className="ml-14 mt-1.5 inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-hover)]"
                        >
                          <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                          Watch how-to
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
      {playing ? (
        <HowToVideoDialog video={playing} onClose={() => setPlaying(null)} />
      ) : null}
    </div>
  );
}
