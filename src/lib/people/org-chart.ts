import type { Department, Profile } from "@/lib/types/database";
import {
  managerForDepartment,
  type DepartmentManagerMap,
} from "@/lib/types/department-managers";

export type OrgNode = {
  profile: Profile;
  children: OrgNode[];
};

/** Display order for department org charts. */
export const ORG_CHART_DEPARTMENTS: Department[] = [
  "Office",
  "Audiovisual",
  "Corporate",
  "Wedding & Social",
  "Golf",
];

/** Active people who include this department (multi-dept people appear in each). */
export function profilesInDepartment(
  profiles: Profile[],
  department: Department,
): Profile[] {
  return profiles.filter((p) => p.departments.includes(department));
}

/**
 * Build org trees within a profile set using a manager lookup.
 * Roots = no manager, or manager not in this set (e.g. other department).
 */
export function buildOrgForest(
  profiles: Profile[],
  managerOf: (profileId: string) => string | null,
): OrgNode[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const children = new Map<string, Profile[]>();

  for (const p of profiles) {
    const managerId = managerOf(p.id);
    if (!managerId || !byId.has(managerId) || managerId === p.id) continue;
    const list = children.get(managerId) ?? [];
    list.push(p);
    children.set(managerId, list);
  }

  for (const list of children.values()) {
    list.sort((a, b) =>
      (a.full_name || a.email).localeCompare(b.full_name || b.email),
    );
  }

  function nodeFor(profile: Profile, ancestors: Set<string>): OrgNode {
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(profile.id);
    const kids = (children.get(profile.id) ?? []).filter(
      (c) => !nextAncestors.has(c.id),
    );
    return {
      profile,
      children: kids.map((c) => nodeFor(c, nextAncestors)),
    };
  }

  const roots = profiles
    .filter((p) => {
      const managerId = managerOf(p.id);
      if (!managerId || managerId === p.id) return true;
      return !byId.has(managerId);
    })
    .sort((a, b) =>
      (a.full_name || a.email).localeCompare(b.full_name || b.email),
    );

  return roots.map((p) => nodeFor(p, new Set()));
}

/** Department org chart using per-department manager assignments. */
export function buildDepartmentOrgForest(
  profiles: Profile[],
  department: Department,
  managers: DepartmentManagerMap = {},
): OrgNode[] {
  const members = profilesInDepartment(profiles, department);
  return buildOrgForest(members, (profileId) => {
    const profile = members.find((p) => p.id === profileId);
    return managerForDepartment(
      managers,
      profileId,
      department,
      profile?.reports_to ?? null,
    );
  });
}

/**
 * True if assigning managerId as this person's manager in a department
 * would create a cycle within that department's reporting edges.
 */
export function wouldCreateDepartmentCycle(
  profiles: Profile[],
  managers: DepartmentManagerMap,
  department: Department,
  personId: string,
  managerId: string | null,
): boolean {
  if (!managerId) return false;
  if (managerId === personId) return true;

  const byId = new Map(profiles.map((p) => [p.id, p]));
  let current: string | null = managerId;
  const seen = new Set<string>();
  while (current) {
    if (current === personId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    const profile = byId.get(current);
    current = managerForDepartment(
      managers,
      current,
      department,
      profile?.reports_to ?? null,
    );
  }
  return false;
}

/** @deprecated Prefer wouldCreateDepartmentCycle for per-dept charts. */
export function wouldCreateCycle(
  profiles: Profile[],
  personId: string,
  managerId: string | null,
): boolean {
  if (!managerId) return false;
  if (managerId === personId) return true;

  const byId = new Map(profiles.map((p) => [p.id, p]));
  let current: string | null = managerId;
  const seen = new Set<string>();
  while (current) {
    if (current === personId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current)?.reports_to ?? null;
  }
  return false;
}
