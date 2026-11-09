import { SERVICE_CATEGORIES } from "./categories";

/** Default categories, then custom ones, then any category an item already uses. No duplicates (case-insensitive). */
export function mergeCategories(custom: string[], used: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...SERVICE_CATEGORIES, ...custom, ...used]) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function cleanCategoryName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 60);
}
