"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NAV_GROUPS } from "@/components/layout/sidebar";
import { buildCrumbs } from "@/lib/breadcrumbs";

const LABELS: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.label] as const)),
);

/** Trail at the top of every Hub page (Home / Section / Page) so people can step back up. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname ?? "/", LABELS);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-xs text-[var(--muted)]">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden /> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="truncate hover:text-[var(--foreground)] hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-[var(--foreground)]">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
