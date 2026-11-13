export type MatchableProfile = {
  id: string;
  full_name: string;
  email: string;
  is_active?: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split planner / sheet assigned-staff text into candidate name tokens.
 * Handles "Alex & Jordan", "Alex, Jordan", "Alex / Jordan", and website
 * sheet style "David; Hector".
 */
export function splitAssignedStaff(assignedStaff: string | null | undefined): string[] {
  if (!assignedStaff?.trim()) return [];
  return assignedStaff
    .split(/\s*(?:,|;|&|\/|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Match planner assigned-staff text to Hub profiles (full name, then first name).
 * Returns unique matched profiles, longest full-name wins per token.
 */
export function matchAssignedStaffProfiles(
  assignedStaff: string | null | undefined,
  profiles: MatchableProfile[],
): MatchableProfile[] {
  const active = profiles.filter((p) => p.is_active !== false);
  if (!assignedStaff?.trim() || active.length === 0) return [];

  const haystack = assignedStaff.toLowerCase();
  const matched = new Map<string, MatchableProfile>();

  const byNameLength = [...active].sort(
    (a, b) =>
      (b.full_name?.trim().length ?? 0) - (a.full_name?.trim().length ?? 0),
  );

  for (const person of byNameLength) {
    const name = person.full_name?.trim().toLowerCase();
    if (name && name.length >= 2 && haystack.includes(name)) {
      matched.set(person.id, person);
    }
  }

  const tokens = splitAssignedStaff(assignedStaff);
  for (const token of tokens) {
    const tokenLower = token.toLowerCase();
    let found = byNameLength.find((person) => {
      const name = person.full_name?.trim().toLowerCase();
      return Boolean(name && (name === tokenLower || name.includes(tokenLower)));
    });

    if (!found) {
      const first = tokenLower.split(/\s+/)[0] ?? "";
      if (first.length >= 2) {
        found = byNameLength.find((person) => {
          const personFirst =
            person.full_name?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
          if (!personFirst) return false;
          const pattern = new RegExp(
            `(?:^|[^a-z])${escapeRegExp(personFirst)}(?:[^a-z]|$)`,
          );
          return pattern.test(tokenLower) || personFirst === first;
        });
      }
    }

    if (found) matched.set(found.id, found);
  }

  return Array.from(matched.values());
}
