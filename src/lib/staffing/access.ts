import type { UserRole } from "@/lib/types/database";

/** Admins and Leads (trainer) can open the Staffing coverage board. */
export function canAccessStaffing(role: UserRole | string | null | undefined): boolean {
  return role === "admin" || role === "trainer";
}
