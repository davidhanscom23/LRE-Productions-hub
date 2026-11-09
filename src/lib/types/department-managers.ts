import type { Department } from "@/lib/types/database";

/** One manager assignment for a person within a single department org chart. */
export type DepartmentManagerEdge = {
  profile_id: string;
  department: Department;
  reports_to: string | null;
};

/** Map profileId -> department -> managerId (or null / missing). */
export type DepartmentManagerMap = Record<
  string,
  Partial<Record<Department, string | null>>
>;

export function buildDepartmentManagerMap(
  edges: DepartmentManagerEdge[],
): DepartmentManagerMap {
  const map: DepartmentManagerMap = {};
  for (const edge of edges) {
    if (!map[edge.profile_id]) map[edge.profile_id] = {};
    map[edge.profile_id]![edge.department] = edge.reports_to;
  }
  return map;
}

export function managerForDepartment(
  map: DepartmentManagerMap,
  profileId: string,
  department: Department,
  fallbackReportsTo?: string | null,
): string | null {
  const entry = map[profileId];
  if (entry && Object.prototype.hasOwnProperty.call(entry, department)) {
    return entry[department] ?? null;
  }
  return fallbackReportsTo ?? null;
}
