/** Match exported HoneyBook files to Hub projects by filename. Pure. */

export type MatchProject = { id: string; name: string; clientName: string };
export type ArchiveKind = "contract" | "invoice" | "proposal" | "other";

const STOP = new Set([
  "the", "and", "for", "of", "a", "an", "to", "pdf", "signed", "contract", "agreement", "invoice", "proposal",
  "event", "copy", "final", "vident", "productions", "services", "service", "inv", "doc", "document", "wedding",
]);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
}

export function guessKind(fileName: string): ArchiveKind {
  const n = fileName.toLowerCase();
  if (/contract|agreement|signed/.test(n)) return "contract";
  if (/invoice|\binv\b/.test(n)) return "invoice";
  if (/proposal|quote|estimate/.test(n)) return "proposal";
  return "other";
}

export type Match = { projectId: string; score: number; confident: boolean } | null;

/**
 * Score = share of the project's (name + client) words found in the file name.
 * Confident only when the best match is clearly ahead of the runner-up.
 */
export function matchProject(fileName: string, projects: MatchProject[]): Match {
  const fileTokens = new Set(tokens(fileName));
  if (!fileTokens.size) return null;
  const scored = projects
    .map((p) => {
      const want = Array.from(new Set([...tokens(p.name), ...tokens(p.clientName)]));
      if (!want.length) return { id: p.id, score: 0 };
      const hit = want.filter((t) => fileTokens.has(t)).length;
      return { id: p.id, score: hit / want.length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const [best, next] = scored;
  return { projectId: best.id, score: best.score, confident: best.score >= 0.6 && (!next || best.score - next.score >= 0.25) };
}
