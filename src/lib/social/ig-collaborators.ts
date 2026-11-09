/**
 * Normalize Instagram collaborator usernames for Meta Graph API Collabs.
 * Meta allows up to 3 usernames on feed image / Reels / carousel create.
 */

const MAX_IG_COLLABORATORS = 3;
const USERNAME_RE = /^[a-z0-9._]{1,30}$/i;

export function normalizeIgCollaborators(
  input: string[] | string | null | undefined,
): { usernames: string[]; error: string | null } {
  const raw: string[] = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[,;\s]+/)
      : [];

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const username = item.trim().replace(/^@+/, "").toLowerCase();
    if (!username) continue;
    if (!USERNAME_RE.test(username)) {
      return {
        usernames: [],
        error: `“${item.trim()}” is not a valid Instagram username.`,
      };
    }
    if (seen.has(username)) continue;
    seen.add(username);
    cleaned.push(username);
    if (cleaned.length > MAX_IG_COLLABORATORS) {
      return {
        usernames: [],
        error: `Instagram allows at most ${MAX_IG_COLLABORATORS} collaborators per post.`,
      };
    }
  }

  return { usernames: cleaned, error: null };
}

/** Meta create-media `collaborators` query value: ['user1','user2'] */
export function formatIgCollaboratorsParam(usernames: string[]): string {
  return `[${usernames.map((name) => `'${name}'`).join(",")}]`;
}
