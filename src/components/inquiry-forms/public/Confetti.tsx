"use client";

import { useEffect, useRef } from "react";
import { runConfetti } from "./confetti-canvas";

/** Decorative confetti layer over its positioned parent. Renders nothing under reduced motion. */
export function Confetti({ active, colors, reducedMotion }: { active: boolean; colors: string[]; reducedMotion: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palette = colors.join(",");

  useEffect(() => {
    if (!active || reducedMotion || !ref.current) return;
    return runConfetti(ref.current, { colors: palette.split(",") });
  }, [active, reducedMotion, palette]);

  if (reducedMotion) return null;
  return <canvas ref={ref} className="iqf-confetti" aria-hidden="true" />;
}
