import type { HandbookSection } from "@/lib/handbook/content";

function sectionHaystack(section: HandbookSection): string {
  const parts: string[] = [section.title];
  for (const block of section.blocks) {
    if (block.heading) parts.push(block.heading);
    if (block.paragraphs) parts.push(...block.paragraphs);
    if (block.items) parts.push(...block.items);
    if (block.footnote) parts.push(block.footnote);
  }
  return parts.join("\n").toLowerCase();
}

/** Case-insensitive match against section title and block text. */
export function sectionMatchesQuery(
  section: HandbookSection,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return sectionHaystack(section).includes(trimmed);
}

export function filterHandbookSections(
  sections: HandbookSection[],
  query: string,
): HandbookSection[] {
  const trimmed = query.trim();
  if (!trimmed) return sections;
  return sections.filter((section) => sectionMatchesQuery(section, trimmed));
}
