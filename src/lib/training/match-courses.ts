import type { TrainingCourse } from "@/lib/types/training";

/** Case-insensitive match on title, blurb, audience, and slug. */
export function courseMatchesQuery(
  course: Pick<TrainingCourse, "title" | "blurb" | "audience" | "slug">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [course.title, course.blurb, course.audience, course.slug]
    .join("\n")
    .toLowerCase()
    .includes(q);
}

export function filterCoursesByQuery<T extends TrainingCourse>(
  courses: T[],
  query: string,
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return courses;
  return courses.filter((course) => courseMatchesQuery(course, trimmed));
}
