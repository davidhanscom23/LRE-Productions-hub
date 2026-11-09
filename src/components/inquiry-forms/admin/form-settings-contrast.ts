/**
 * WCAG contrast helpers for the accent color picker (white button text on the accent).
 * Pure; unit tested in form-settings-contrast.test.ts.
 */

export const MIN_TEXT_CONTRAST = 4.5;

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** "#abc" / "#AABBCC" -> "#aabbcc"; anything else -> null. */
export function normalizeHex(value: string): string | null {
  const v = value.trim();
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  return v.toLowerCase();
}

function channels(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

function linear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const rgb = channels(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast of white text on the color, rounded down to one decimal (never overstated). */
export function whiteTextContrast(hex: string): number | null {
  const ratio = contrastRatio("#ffffff", hex);
  return ratio === null ? null : Math.floor(ratio * 10) / 10;
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The closest darker shade (same hue, scaled toward black) that white text can sit on at
 * `target` contrast. Returns the color itself when it already passes, null for bad input.
 */
export function darkenForWhiteText(hex: string, target = MIN_TEXT_CONTRAST): string | null {
  const rgb = channels(hex);
  if (!rgb) return null;
  const start = normalizeHex(hex) as string;
  if ((contrastRatio("#ffffff", start) ?? 0) >= target) return start;
  for (let f = 0.98; f >= 0; f -= 0.02) {
    const candidate = toHex([rgb[0] * f, rgb[1] * f, rgb[2] * f]);
    if ((contrastRatio("#ffffff", candidate) ?? 0) >= target) return candidate;
  }
  return "#000000";
}
