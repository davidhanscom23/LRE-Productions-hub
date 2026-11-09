/**
 * Inquiry Forms public renderer - tiny in-house confetti (one canvas, no dependency).
 *
 * Two bursts from the lower corners (LeadGate's angles 60 and 120 degrees, spread 55), gravity and drag,
 * about 2.4 s, then the canvas is cleared. Callers skip it entirely under prefers-reduced-motion.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  round: boolean;
}

export interface ConfettiOptions {
  colors: string[];
  durationMs?: number;
  /** Particles per side per emitted frame during the first second. */
  perFrame?: number;
}

const DEG = Math.PI / 180;

function burst(out: Particle[], x: number, y: number, angleDeg: number, colors: string[], count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (angleDeg + (Math.random() - 0.5) * 55) * DEG;
    const speed = 7 + Math.random() * 6;
    out.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(angle) * speed,
      size: 6 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)] ?? "#22c55e",
      round: Math.random() < 0.35,
    });
  }
}

/** Run confetti on `canvas` (sized to its CSS box). Returns a cancel function that also clears it. */
export function runConfetti(canvas: HTMLCanvasElement, opts: ConfettiOptions): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof window === "undefined") return () => undefined;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = opts.colors.length ? opts.colors : ["#22c55e", "#fbbf24"];
  const duration = opts.durationMs ?? 2400;
  const emitUntil = Math.min(1000, duration / 2);
  const perFrame = opts.perFrame ?? 3;
  const particles: Particle[] = [];
  const start = performance.now();
  let raf = 0;
  let done = false;

  const frame = (now: number) => {
    if (done) return;
    const t = now - start;
    if (t < emitUntil) {
      burst(particles, 0, height * 0.7, 60, colors, perFrame);
      burst(particles, width, height * 0.7, 120, colors, perFrame);
    }
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      p.vy += 0.28;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
      }
      ctx.restore();
    }
    if (t < duration) {
      raf = window.requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, width, height);
      done = true;
    }
  };
  raf = window.requestAnimationFrame(frame);

  return () => {
    done = true;
    window.cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, width, height);
  };
}
