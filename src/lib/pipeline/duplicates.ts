/**
 * Likely-duplicate detection for Pipeline (Hub CRM) projects.
 *
 * Pure functions only: the board, the create form and the merge dialog all share them.
 * A pair scores points for same client, same / similar name and same date. Two different
 * dates are a strong "not the same event" signal, so a recurring event (a gala in 2026 and
 * 2027) is not flagged. A missing date on either card says nothing either way.
 */

export type DupCandidate = {
  id: string;
  name: string;
  client_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  project_date?: string | null;
  stage?: string | null;
  merged_into?: string | null;
};

export type DupMatch = {
  id: string;
  score: number;
  reasons: string[];
};

/** Score at or above which two cards are shown as "possible duplicates". */
export const DUPLICATE_SCORE_THRESHOLD = 5;

const CLOSED = new Set(["lost", "archived"]);

const FILLER_WORDS = new Set([
  "the", "a", "an", "and", "of", "for", "at", "in", "event", "events", "party",
  "inquiry", "new", "lead", "project", "wedding", "corporate", "social",
]);

/** Lowercase, strip the "Event – Client" style prefix noise and punctuation. */
export function normalizeProjectName(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[–—-]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const t of normalizeProjectName(raw).split(" ")) {
    if (t && !FILLER_WORDS.has(t)) out.add(t);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function isoDate(raw: string | null | undefined): string | null {
  const m = (raw ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function isOpen(p: DupCandidate): boolean {
  if (p.merged_into) return false;
  return !CLOSED.has((p.stage ?? "").trim().toLowerCase());
}

/** Score how likely `a` and `b` are the same event. Never compares a card with itself. */
export function scoreDuplicate(a: DupCandidate, b: DupCandidate): DupMatch {
  const reasons: string[] = [];
  let score = 0;
  if (a.id === b.id) return { id: b.id, score: 0, reasons };

  const sameClient =
    (a.client_id && b.client_id && a.client_id === b.client_id) ||
    (a.client_email &&
      b.client_email &&
      a.client_email.trim().toLowerCase() === b.client_email.trim().toLowerCase());
  if (sameClient) {
    score += 3;
    reasons.push("same client");
  }

  const na = normalizeProjectName(a.name);
  const nb = normalizeProjectName(b.name);
  if (na && na === nb) {
    score += 3;
    reasons.push("same name");
  } else {
    const sim = jaccard(nameTokens(a.name), nameTokens(b.name));
    if (sim >= 0.6) {
      score += 2;
      reasons.push("similar name");
    }
  }

  const da = isoDate(a.project_date);
  const db = isoDate(b.project_date);
  if (da && db) {
    if (da === db) {
      score += 2;
      reasons.push("same date");
    } else {
      score -= 3;
      reasons.push("different dates");
    }
  }

  return { id: b.id, score, reasons };
}

/** Cards that look like the same event as `candidate`, best match first. */
export function findSimilarProjects(
  candidate: DupCandidate,
  projects: DupCandidate[],
): DupMatch[] {
  return projects
    .filter((p) => p.id !== candidate.id && isOpen(p))
    .map((p) => scoreDuplicate(candidate, p))
    .filter((m) => m.score >= DUPLICATE_SCORE_THRESHOLD)
    .sort((x, y) => y.score - x.score);
}

/** Map of card id to the cards it may duplicate, for the "Possible duplicate" badge. */
export function buildDuplicateMap(
  projects: DupCandidate[],
): Map<string, DupMatch[]> {
  const open = projects.filter(isOpen);
  const out = new Map<string, DupMatch[]>();
  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) {
      const m = scoreDuplicate(open[i], open[j]);
      if (m.score < DUPLICATE_SCORE_THRESHOLD) continue;
      out.set(open[i].id, [...(out.get(open[i].id) ?? []), { ...m, id: open[j].id }]);
      out.set(open[j].id, [...(out.get(open[j].id) ?? []), { ...m, id: open[i].id }]);
    }
  }
  for (const [id, list] of out) {
    out.set(id, list.sort((x, y) => y.score - x.score));
  }
  return out;
}
