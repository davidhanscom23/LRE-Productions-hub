import {
  DEPARTMENTS,
  type Department,
  type UserRole,
} from "@/lib/types/database";

/** Free-text audience values that mean every staffer can see the course. */
const ALL_STAFF_AUDIENCES = new Set([
  "",
  "all",
  "all staff",
  "everyone",
  "company",
  "company-wide",
  "company wide",
]);

/**
 * Map a course `audience` string to department targets.
 * Seeded courses use exact department names (Audiovisual, Corporate,
 * Wedding & Social, Golf, Office)
 * or "All staff". Custom text that names departments is also recognized.
 */
export function courseAudienceDepartments(
  audience: string,
): Department[] | "all" {
  const raw = audience.trim();
  if (!raw || ALL_STAFF_AUDIENCES.has(raw.toLowerCase())) return "all";

  const exact = DEPARTMENTS.find(
    (dept) => dept.toLowerCase() === raw.toLowerCase(),
  );
  if (exact) return [exact];

  const parts = raw
    .split(/[,/|&+]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const fromParts = DEPARTMENTS.filter((dept) =>
    parts.some((part) => part.toLowerCase() === dept.toLowerCase()),
  );
  if (fromParts.length > 0) return fromParts;

  const contained = DEPARTMENTS.filter((dept) =>
    raw.toLowerCase().includes(dept.toLowerCase()),
  );
  if (contained.length > 0) return contained;

  // Unknown custom audience — keep visible so Manage free-text courses aren't hidden.
  return "all";
}

/** Admins and trainers see every course; staff/guests only their departments + All staff. */
export function canViewTrainingCourse(
  audience: string,
  opts: { role: UserRole | string; departments: readonly string[] },
): boolean {
  if (opts.role === "admin" || opts.role === "trainer") return true;
  const target = courseAudienceDepartments(audience);
  if (target === "all") return true;
  const deptSet = new Set(opts.departments.map((d) => d.trim()));
  return target.some((dept) => deptSet.has(dept));
}

export function filterCoursesForViewer<T extends { audience: string }>(
  courses: T[],
  opts: { role: UserRole | string; departments: readonly string[] },
): T[] {
  return courses.filter((course) =>
    canViewTrainingCourse(course.audience, opts),
  );
}

/** Options for Manage → Audience (matches People department checkboxes). */
export const TRAINING_AUDIENCE_OPTIONS = [
  "All staff",
  ...DEPARTMENTS,
] as const;
