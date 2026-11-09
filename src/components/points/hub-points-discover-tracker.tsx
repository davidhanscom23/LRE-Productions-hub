"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { discoverPathAction } from "@/app/(app)/points/actions";

/**
 * Watches the current route and awards one-time discovery points
 * for known Hub modules (see hub_achievements.discover_path).
 */
export function HubPointsDiscoverTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !pathname) return;
    const base =
      pathname === "/"
        ? "/"
        : `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
    if (base === "/" || seen.current.has(base)) return;
    seen.current.add(base);

    void discoverPathAction(base).catch(() => {
      // non-critical
    });
  }, [enabled, pathname]);

  return null;
}
