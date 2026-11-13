import type { UserRole } from "@/lib/types/database";

/** Admins, Leads (trainer), and staff can open the Pipeline CRM module. */
export function canAccessPipeline(
  role: UserRole | string | null | undefined,
): boolean {
  return role === "admin" || role === "trainer" || role === "staff";
}

/**
 * Admin or Lead can create/edit/delete CRM clients & projects (Hub rows).
 * Distinct from card assign / stage-move rights.
 */
export function canManagePipelineCrm(
  role: UserRole | string | null | undefined,
): boolean {
  return role === "admin" || role === "trainer";
}

/** Admins assign staff to projects freely (no approval). */
export function canAssignPipelineFreely(
  role: UserRole | string | null | undefined,
): boolean {
  return role === "admin";
}

/**
 * Admin always; anyone on the assignee list (Lead or staff) can edit/move.
 * Unassigned Leads/staff are view-only on that card.
 */
export function canEditPipelineProject(
  role: UserRole | string | null | undefined,
  assignedProfileIds: Iterable<string> | null | undefined,
  profileId: string | null | undefined,
): boolean {
  if (role === "admin") return true;
  if (!profileId) return false;
  if (role !== "trainer" && role !== "staff") return false;
  for (const id of assignedProfileIds ?? []) {
    if (id === profileId) return true;
  }
  return false;
}
