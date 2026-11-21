import type { Profile } from "@/lib/types/database";

type RoleOnly = Pick<Profile, "role"> | null | undefined;

/** Every admin, Lead and staff member can scan gear. Guests cannot. */
export function canScanGear(profile: RoleOnly): boolean {
  return profile?.role === "admin" || profile?.role === "trainer" || profile?.role === "staff";
}

/** Only admins link, edit or remove tagged gear directly. Everyone else suggests. */
export function isGearAdmin(profile: RoleOnly): boolean {
  return profile?.role === "admin";
}
