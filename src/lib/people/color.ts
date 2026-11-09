/** Normalize user input to #RRGGBB or null. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function isValidHexColor(value: unknown): boolean {
  return normalizeHexColor(value) != null;
}

/** Soft translucent background from a solid hex (for chips/cards). */
export function colorSoftBackground(hex: string, alpha = 0.18): string {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return "var(--brand-soft)";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Black or white text that contrasts with a solid hex fill. */
export function colorContrastText(hex: string): string {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return "var(--brand)";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  // Relative luminance (sRGB approx)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#111111" : "#FFFFFF";
}

export type StaffColorEntry = {
  id: string;
  full_name: string;
  email: string;
  color: string | null;
  is_active: boolean;
};

/**
 * Match DJEP "Assigned Staff" text to a profile color.
 * Tries full-name contains, then first-name token matches.
 */
export function matchStaffColor(
  assignedStaff: string | null | undefined,
  staff: StaffColorEntry[],
): string | null {
  if (!assignedStaff?.trim()) return null;
  const haystack = assignedStaff.toLowerCase();

  const colored = staff.filter((p) => p.color && p.is_active);
  if (colored.length === 0) return null;

  // Prefer longest full-name match so "David Hanscom" beats "David"
  const byNameLength = [...colored].sort(
    (a, b) =>
      (b.full_name?.trim().length ?? 0) - (a.full_name?.trim().length ?? 0),
  );

  for (const person of byNameLength) {
    const name = person.full_name?.trim().toLowerCase();
    if (name && name.length >= 2 && haystack.includes(name)) {
      return person.color;
    }
  }

  for (const person of byNameLength) {
    const first = person.full_name?.trim().split(/\s+/)[0]?.toLowerCase();
    if (!first || first.length < 2) continue;
    // Word-boundary-ish: not a substring of a longer unrelated word
    const pattern = new RegExp(`(?:^|[^a-z])${escapeRegExp(first)}(?:[^a-z]|$)`);
    if (pattern.test(haystack)) {
      return person.color;
    }
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Inline styles for a colored chip / badge. */
export function staffChipStyle(hex: string | null | undefined): {
  backgroundColor: string;
  color: string;
  borderColor?: string;
} {
  const normalized = normalizeHexColor(hex ?? null);
  if (!normalized) {
    return {
      backgroundColor: "var(--brand-soft)",
      color: "var(--brand)",
    };
  }
  return {
    backgroundColor: colorSoftBackground(normalized, 0.22),
    color: normalized,
    borderColor: colorSoftBackground(normalized, 0.45),
  };
}
