/** Ordering helpers for estimate sections and lines (pure, so they can be tested). */

export type OrderLine = { id: string; parent_line_id: string | null };

/** Move id up/down among `ids`. Unchanged at the ends or when id is missing. */
export function moveId(ids: string[], id: string, delta: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = ids.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Move a top-level line up/down within its section. Package contents (lines whose parent_line_id
 * points at it) travel with their package. Returns the new full order of line ids for the section.
 */
export function moveLineInSection(lines: OrderLine[], id: string, delta: -1 | 1): string[] {
  const roots = lines.filter((l) => !l.parent_line_id).map((l) => l.id);
  const movedRoots = moveId(roots, id, delta);
  return movedRoots.flatMap((rid) => [rid, ...lines.filter((l) => l.parent_line_id === rid).map((l) => l.id)]);
}
