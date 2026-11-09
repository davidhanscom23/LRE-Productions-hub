/** URL slug from a course title (lowercase kebab, max 60). */
export function slugifyCourseTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "course";
}
