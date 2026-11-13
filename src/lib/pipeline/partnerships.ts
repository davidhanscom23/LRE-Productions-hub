/**
 * Partnerships: venue / vendor deals tracked on the Pipeline board but kept apart from events.
 * Pure helpers only (no database access).
 */
import { pipelineStageMatchKey } from "@/lib/pipeline/pipeline-board";

export const PARTNERSHIP_STAGES = [
  "Prospect",
  "In Talks",
  "Agreement Sent",
  "Active Partner",
  "Not Moving Forward",
] as const;

export const PARTNER_KINDS = ["Venue", "Vendor", "Other"] as const;

/** Partnership cards are always this gold, whoever is assigned. */
export const PARTNERSHIP_GOLD = "#c9a227";

export const PARTNERSHIP_CLOSED_STAGE = "Not Moving Forward";

export function isPartnership(
  p: { record_type?: string | null } | null | undefined,
): boolean {
  return p?.record_type === "partnership";
}

/** Canonical stage label, or Prospect when the text is not one of the five stages. */
export function normalizePartnershipStage(stage: string | null | undefined): string {
  const key = pipelineStageMatchKey(stage ?? "");
  const hit = PARTNERSHIP_STAGES.find((s) => pipelineStageMatchKey(s) === key);
  return hit ?? PARTNERSHIP_STAGES[0];
}

export function normalizePartnerKind(kind: string | null | undefined): string {
  const k = (kind ?? "").trim().toLowerCase();
  return PARTNER_KINDS.find((x) => x.toLowerCase() === k) ?? "Other";
}

/** Group partnership cards into the five columns (unknown stages land in Prospect). */
export function groupPartnershipsByStage<T extends { stage: string }>(
  projects: T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const s of PARTNERSHIP_STAGES) out[s] = [];
  for (const p of projects) out[normalizePartnershipStage(p.stage)].push(p);
  return out;
}
