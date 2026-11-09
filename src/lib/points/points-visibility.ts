import "server-only";

import type { UserRole } from "@/lib/types/database";

/** Staff, trainers, and admins can open the Activity tab (own or team). */
export function canViewOwnPointsActivity(
  role: string | null | undefined,
): boolean {
  return role === "admin" || role === "trainer" || role === "staff";
}

/** Full team Activity ledger — admin and trainer only. */
export function canViewTeamPointsActivity(
  role: string | null | undefined,
): boolean {
  return role === "admin" || role === "trainer";
}

export function isElevatedPointsRole(
  role: UserRole | string | null | undefined,
): boolean {
  return canViewTeamPointsActivity(role);
}
