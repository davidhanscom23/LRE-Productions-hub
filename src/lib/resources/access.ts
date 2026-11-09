import type { UserRole } from "@/lib/types/database";

type Role = UserRole | string | null | undefined;

/** Staff, Lead (trainer), and Admin can add a resource. Guests cannot. */
export function canAddResource(role: Role): boolean {
  return role === "admin" || role === "trainer" || role === "staff";
}

/** Lead and Admin can edit resource metadata. */
export function canEditResource(role: Role): boolean {
  return role === "admin" || role === "trainer";
}

/** Only admins can delete resources. */
export function canDeleteResource(role: Role): boolean {
  return role === "admin";
}
