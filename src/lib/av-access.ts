import type { Profile } from "@/lib/types/database";

/** Admins and anyone assigned to the AV department can open LRE AV. */
export function canAccessAv(
  profile: Pick<Profile, "role" | "departments"> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  return profile.departments.includes("Audiovisual");
}

/** Admin-only financial gates (legacy helper; Hub Costs/Reports use canAccessAv). */
export function canViewAvFinancials(
  profile: Pick<Profile, "role"> | null | undefined,
): boolean {
  return profile?.role === "admin";
}
