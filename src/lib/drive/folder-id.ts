/** Extract a Drive folder id from a raw id or drive.google.com folder URL. */
export function parseDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Plain folder id
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("google.com")) return null;
    const foldersMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (foldersMatch?.[1]) return foldersMatch[1];
    const idParam = url.searchParams.get("id");
    if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) return idParam;
  } catch {
    return null;
  }
  return null;
}
