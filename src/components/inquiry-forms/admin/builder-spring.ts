/**
 * Drop settle for the builder's drag and drop: a real spring, not a fixed ease.
 *
 * Ported from the Kivi reference (agency-board AgentDashboardsGrid SPRING_DROP): damping 0.8,
 * response 0.4 s, integrated once into keyframes. Two details break it if changed:
 * - `easing: "linear"` is required: the keyframes already carry the spring's shape.
 * - `duration` must equal the span the keyframes were sampled over.
 * Scale is interpolated linearly (an overshooting size reads as a bug, not momentum).
 */
import { useSyncExternalStore } from "react";
import type { DropAnimation, DropAnimationKeyframeResolver } from "@dnd-kit/core";

const SPRING_DAMPING = 0.8;
const SPRING_RESPONSE = 0.4; // seconds to reach the target, not a duration
const SPRING_MAX_MS = 900;

function springSamples(): { t: number; v: number }[] {
  const omega = (2 * Math.PI) / SPRING_RESPONSE;
  const k = omega * omega;
  const c = 2 * SPRING_DAMPING * omega;
  const dt = 1 / 120;
  let x = 1;
  let v = 0;
  const out: { t: number; v: number }[] = [{ t: 0, v: 1 }];
  for (let t = dt; t <= SPRING_MAX_MS / 1000; t += dt) {
    v += (-k * x - c * v) * dt;
    x += v * dt;
    out.push({ t, v: x });
    if (Math.abs(x) < 0.001 && Math.abs(v) < 0.01) break;
  }
  // Land exactly on the target without a duplicate final timestamp.
  out[out.length - 1].v = 0;
  return out;
}

const SPRING_CURVE = springSamples();
const SPRING_SPAN = SPRING_CURVE[SPRING_CURVE.length - 1].t || 1;
const SPRING_MS = Math.round(SPRING_SPAN * 1000);

const springKeyframes: DropAnimationKeyframeResolver = ({ transform }) => {
  const { initial, final } = transform;
  return SPRING_CURVE.map(({ t, v }) => {
    // v goes 1 -> 0: the REMAINING fraction of the journey.
    const x = final.x + (initial.x - final.x) * v;
    const y = final.y + (initial.y - final.y) * v;
    const p = t / SPRING_SPAN;
    const sx = initial.scaleX + (final.scaleX - initial.scaleX) * p;
    const sy = initial.scaleY + (final.scaleY - initial.scaleY) * p;
    return {
      offset: Math.min(1, p),
      transform: `translate3d(${x}px, ${y}px, 0) scaleX(${sx}) scaleY(${sy})`,
    };
  });
};

export const SPRING_DROP: DropAnimation = {
  duration: SPRING_MS,
  easing: "linear",
  keyframes: springKeyframes,
};

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True when the person asked the OS for less motion (no spring, no overshoot). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** The drop animation to use: the spring, or none for reduced motion. */
export function useDropAnimation(): DropAnimation | null {
  return useReducedMotion() ? null : SPRING_DROP;
}
