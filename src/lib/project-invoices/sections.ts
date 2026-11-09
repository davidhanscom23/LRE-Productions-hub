/** Sections for project invoices: customers see item names and quantities, with one total per section. */

export type Sectioned = { section?: string };
export type SectionLine = { description: string; qty: number; unit_price: number; section?: string };
export type SectionGroup<T extends SectionLine> = { name: string; lines: T[]; total: number };

export const DEFAULT_SECTION = "Items";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Group lines by section, keeping the order sections first appear. Blank names become "Items". */
export function groupBySection<T extends SectionLine>(lines: T[]): SectionGroup<T>[] {
  const out: SectionGroup<T>[] = [];
  for (const l of lines) {
    const name = (l.section ?? "").trim() || DEFAULT_SECTION;
    let g = out.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!g) {
      g = { name, lines: [], total: 0 };
      out.push(g);
    }
    g.lines.push(l);
    g.total = r2(g.total + l.qty * l.unit_price);
  }
  return out;
}

/** Move item `index` of `arr` by `delta` (-1 up, +1 down). Returns a new array, unchanged at the ends. */
export function moveItem<T>(arr: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= arr.length || to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Move a whole section (all of its lines) up or down among the sections. */
export function moveSection<T extends Sectioned>(lines: T[], sectionName: string, delta: -1 | 1): T[] {
  const key = (l: Sectioned) => ((l.section ?? "").trim() || DEFAULT_SECTION).toLowerCase();
  const groups: T[][] = [];
  for (const l of lines) {
    const g = groups.find((x) => key(x[0]) === key(l));
    if (g) g.push(l);
    else groups.push([l]);
  }
  const i = groups.findIndex((g) => key(g[0]) === sectionName.trim().toLowerCase());
  return moveItem(groups, i, delta).flat();
}

/** Rename a section on every line that belongs to it. */
export function renameSection<T extends Sectioned>(lines: T[], from: string, to: string): T[] {
  const f = (from.trim() || DEFAULT_SECTION).toLowerCase();
  const name = to.trim();
  return lines.map((l) => ((l.section ?? "").trim() || DEFAULT_SECTION).toLowerCase() === f ? { ...l, section: name } : l);
}
