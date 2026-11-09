/** Pure match helpers for Event Packet ↔ HoneyBook CRM linking (testable). */

/** Normalize client / project labels for fuzzy match. */
export function normalizeCrmLabel(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when packet client name and CRM project/client labels plausibly match.
 * Requires both sides non-empty after normalize; either contains the other or
 * they share a significant token (≥4 chars).
 */
export function crmLabelsMatch(
  packetClient: string | null | undefined,
  projectName: string | null | undefined,
  clientName: string | null | undefined,
): boolean {
  const a = normalizeCrmLabel(packetClient);
  if (!a) return false;
  const candidates = [projectName, clientName]
    .map(normalizeCrmLabel)
    .filter(Boolean);
  for (const b of candidates) {
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const aTokens = new Set(a.split(" ").filter((t) => t.length >= 4));
    const bTokens = b.split(" ").filter((t) => t.length >= 4);
    if (bTokens.some((t) => aTokens.has(t))) return true;
  }
  return false;
}
