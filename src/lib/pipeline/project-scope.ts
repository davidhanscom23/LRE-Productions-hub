/** Which Pipeline projects the Projects tab shows: only mine, or everyone's. */
export type ProjectScope = "mine" | "everyone";

/** Person filter values: "" = anyone, "unassigned", or a profile id. */
export const UNASSIGNED_FILTER = "unassigned";

export const PROJECT_SCOPE_STORAGE_KEY = "lre-pipeline-project-scope-v1";

type WithAssignees = { assignees?: { profile_id: string }[] | null };

export function isValidScope(v: unknown): v is ProjectScope {
  return v === "mine" || v === "everyone";
}

/** Admins start on Everyone; everyone else starts on My projects. */
export function defaultScope(isAdmin: boolean): ProjectScope {
  return isAdmin ? "everyone" : "mine";
}

export function isAssignedTo(p: WithAssignees, profileId: string): boolean {
  if (!profileId) return false;
  return (p.assignees ?? []).some((a) => a.profile_id === profileId);
}

export function isUnassigned(p: WithAssignees): boolean {
  return (p.assignees ?? []).length === 0;
}

/**
 * Apply the scope and person filter. The person filter only applies on
 * "everyone" (My projects already means "me").
 */
export function matchesScope(
  p: WithAssignees,
  opts: { scope: ProjectScope; profileId: string; personFilter: string },
): boolean {
  if (opts.scope === "mine") return isAssignedTo(p, opts.profileId);
  if (!opts.personFilter) return true;
  if (opts.personFilter === UNASSIGNED_FILTER) return isUnassigned(p);
  return isAssignedTo(p, opts.personFilter);
}
