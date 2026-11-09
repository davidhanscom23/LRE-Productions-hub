/**
 * Inquiry Forms public renderer - accent palette helpers (pure, no DOM).
 *
 * The admin picks one accent hex per form. This module turns it into the few CSS variables
 * the light form palette needs, keeping every text pair at WCAG AA (4.5:1):
 * - a button fill that carries a white label (darkened a little when the raw accent is too light),
 *   or a near-black label when the accent is a light color that darkening cannot rescue;
 * - an accent "text" color for links, selected labels and focus rings on white;
 * - a soft tint for selected cards (text on it stays full ink color).
 */

export const INK = "#16181d";
export const WHITE = "#ffffff";
const BLACK = "#000000";
const FALLBACK_ACCENT = "#1f2937";
const AA = 4.5;

export interface FormThemeVars {
  "--iqf-accent": string;
  "--iqf-on-accent": string;
  "--iqf-accent-text": string;
  "--iqf-accent-soft": string;
  "--iqf-accent-line": string;
}

/** "#abc" / "#AABBCC" -> "#aabbcc"; anything else -> null. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a 6-digit hex. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two 6-digit hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `b` into `a` by `weight` (0..1) in sRGB space. */
export function mixHex(a: string, b: string, weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex([
    ra[0] + (rb[0] - ra[0]) * w,
    ra[1] + (rb[1] - ra[1]) * w,
    ra[2] + (rb[2] - ra[2]) * w,
  ]);
}

/** Darken `hex` in 4% steps until it reaches `ratio` against `against`; null when 40% is not enough. */
function darkenUntil(hex: string, against: string, ratio: number, maxWeight: number): string | null {
  if (contrastRatio(hex, against) >= ratio) return hex;
  for (let w = 0.04; w <= maxWeight + 1e-9; w += 0.04) {
    const d = mixHex(hex, BLACK, w);
    if (contrastRatio(d, against) >= ratio) return d;
  }
  return null;
}

/** Accent colors for one form, as CSS custom properties for the renderer root. */
export function buildFormTheme(accentInput: unknown): FormThemeVars {
  const base = normalizeHex(accentInput) ?? FALLBACK_ACCENT;

  // Button: prefer a white label; darken a mid-tone accent up to 40% before giving up on white.
  let fill = base;
  let onFill = WHITE;
  const darkened = darkenUntil(base, WHITE, AA, 0.4);
  if (darkened) {
    fill = darkened;
  } else if (contrastRatio(base, INK) >= AA) {
    onFill = INK;
  } else {
    fill = darkenUntil(base, WHITE, AA, 1) ?? INK;
  }

  // Accent used as text (links, selected labels, focus ring) on white: always >= 4.5:1.
  const text = darkenUntil(base, WHITE, AA, 1) ?? INK;

  return {
    "--iqf-accent": fill,
    "--iqf-on-accent": onFill,
    "--iqf-accent-text": text,
    "--iqf-accent-soft": mixHex(base, WHITE, 0.92),
    "--iqf-accent-line": mixHex(base, WHITE, 0.55),
  };
}

/** Text color (ink or white) with the better contrast on an arbitrary background hex. */
export function readableOn(bgInput: unknown): string {
  const bg = normalizeHex(bgInput) ?? WHITE;
  return contrastRatio(bg, INK) >= contrastRatio(bg, WHITE) ? INK : WHITE;
}
