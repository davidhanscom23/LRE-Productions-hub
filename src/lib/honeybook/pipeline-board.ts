import { HONEYBOOK_STAGE_HINTS } from "@/lib/types/honeybook";

export const HONEYBOOK_NO_STAGE = "(no stage)";

/**
 * Default Projects board columns, in this order. They always show (even when
 * empty); other stages only show when they have projects.
 */
export const HONEYBOOK_DEFAULT_BOARD_STAGES = [
  "Inquiry",
  "Proposal Sent",
  "Contract Sent",
  "Retainer Paid",
  "Paid in Full",
  "Completed",
  "Lost",
] as const;

/**
 * Old stage names that no longer exist, mapped to the stage they became. Applied when
 * stages arrive from Zapier, email sync, or CSV so removed columns do not come back.
 */
export function normalizeHoneyBookStage(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return s;
  return honeyBookStageMatchKey(s) === "not booked" ? "Lost" : s;
}

/** Normalize for grouping: `_PROPOSAL_SENT_` and `Proposal Sent` → same key. */
export function honeyBookStageMatchKey(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return HONEYBOOK_NO_STAGE;
  if (s === HONEYBOOK_NO_STAGE) return HONEYBOOK_NO_STAGE;
  return s
    .replace(/^_+|_+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Title Case label for UI (Retainer Paid, Paid in Full, …). */
export function formatHoneyBookStageLabel(
  raw: string | null | undefined,
): string {
  const key = honeyBookStageMatchKey(raw);
  if (key === HONEYBOOK_NO_STAGE) return HONEYBOOK_NO_STAGE;

  // Prefer canonical hint casing when it matches.
  for (const hint of HONEYBOOK_STAGE_HINTS) {
    if (honeyBookStageMatchKey(hint) === key) return hint;
  }

  return key
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Column order: the default board stages first, then the other canonical stage
 * hints (as labels), then any other in-use stages (by pretty label), then unstaged if present.
 */
export function orderedPipelineStages(
  projectStages: Iterable<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const pushLabel = (label: string) => {
    const key = honeyBookStageMatchKey(label);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(formatHoneyBookStageLabel(label));
  };

  for (const stage of HONEYBOOK_DEFAULT_BOARD_STAGES) pushLabel(stage);
  for (const hint of HONEYBOOK_STAGE_HINTS) pushLabel(hint);

  const extras = Array.from(
    new Set(
      Array.from(projectStages)
        .map((s) => s.trim())
        .filter((s) => s && honeyBookStageMatchKey(s) !== HONEYBOOK_NO_STAGE),
    ),
  )
    .map((s) => formatHoneyBookStageLabel(s))
    .filter((label) => !seen.has(honeyBookStageMatchKey(label)))
    .sort((a, b) => a.localeCompare(b));

  for (const label of extras) pushLabel(label);

  const hasUnstaged = Array.from(projectStages).some(
    (s) => honeyBookStageMatchKey(s) === HONEYBOOK_NO_STAGE,
  );
  if (hasUnstaged) pushLabel(HONEYBOOK_NO_STAGE);

  return out;
}

/** Group projects into columns keyed by pretty stage label. */
export function groupProjectsByStage<
  T extends { id: string; stage: string },
>(projects: T[], columns: string[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  const keyToColumn = new Map<string, string>();
  for (const col of columns) {
    map.set(col, []);
    keyToColumn.set(honeyBookStageMatchKey(col), col);
  }
  if (!map.has(HONEYBOOK_NO_STAGE)) {
    map.set(HONEYBOOK_NO_STAGE, []);
    keyToColumn.set(HONEYBOOK_NO_STAGE, HONEYBOOK_NO_STAGE);
  }

  for (const p of projects) {
    const key = honeyBookStageMatchKey(p.stage);
    let col = keyToColumn.get(key);
    if (!col) {
      col = formatHoneyBookStageLabel(p.stage);
      keyToColumn.set(key, col);
      map.set(col, []);
    }
    const list = map.get(col) ?? [];
    list.push(p);
    map.set(col, list);
  }
  return map;
}

/** Aggregate counts by pretty label (highest first). */
export function countProjectsByStageLabel(
  projects: Iterable<{ stage: string }>,
): [string, number][] {
  const m = new Map<string, number>();
  for (const p of projects) {
    const label = formatHoneyBookStageLabel(p.stage);
    m.set(label, (m.get(label) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const HONEYBOOK_BOARD_ORDER_KEY = "honeybook-board-column-order-v1";

/**
 * Reorder columns using a preferred list of match keys (or labels).
 * Unknown preferred keys are skipped; leftover columns keep relative order at the end.
 */
export function applyPipelineColumnOrder(
  columns: string[],
  preferredOrder: Iterable<string> | null | undefined,
): string[] {
  if (!preferredOrder) return columns;
  const preferred = Array.from(preferredOrder)
    .map((s) => honeyBookStageMatchKey(s))
    .filter(Boolean);
  if (!preferred.length) return columns;

  const byKey = new Map<string, string>();
  for (const col of columns) byKey.set(honeyBookStageMatchKey(col), col);

  const out: string[] = [];
  const used = new Set<string>();
  for (const key of preferred) {
    const col = byKey.get(key);
    if (!col || used.has(key)) continue;
    out.push(col);
    used.add(key);
  }
  for (const col of columns) {
    const key = honeyBookStageMatchKey(col);
    if (used.has(key)) continue;
    out.push(col);
    used.add(key);
  }
  return out;
}

/** Move `fromKey` to sit before `toKey` (or at end if toKey missing). */
export function movePipelineColumn(
  columns: string[],
  fromLabel: string,
  toLabel: string,
): string[] {
  const fromKey = honeyBookStageMatchKey(fromLabel);
  const toKey = honeyBookStageMatchKey(toLabel);
  if (!fromKey || fromKey === toKey) return columns;

  const keys = columns.map((c) => honeyBookStageMatchKey(c));
  const fromIdx = keys.indexOf(fromKey);
  if (fromIdx < 0) return columns;
  const next = [...columns];
  const [moved] = next.splice(fromIdx, 1);
  let toIdx = next.findIndex(
    (c) => honeyBookStageMatchKey(c) === toKey,
  );
  if (toIdx < 0) toIdx = next.length;
  next.splice(toIdx, 0, moved);
  return next;
}
