/** Sanitize a path/folder segment for storage keys and Drive-safe names. */
export function sanitizeNamePart(value: string): string {
  return value
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim() || "Untitled";
}

export function folderSlugFromName(name: string): string {
  return sanitizeNamePart(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "venue";
}

export function buildEventFolderName(input: {
  locationName: string;
  djName: string;
  eventDate: string;
}): string {
  const location = sanitizeNamePart(input.locationName);
  const dj = sanitizeNamePart(input.djName || "Staff");
  const date = input.eventDate.trim() || "undated";
  return `${location} - ${dj} - ${date}`;
}

export function buildMediaFileName(input: {
  locationName: string;
  djName: string;
  eventDate: string;
  sequence: number;
  extension: string;
}): string {
  const base = buildEventFolderName(input);
  const seq = String(Math.max(1, input.sequence)).padStart(2, "0");
  const ext = input.extension.replace(/^\./, "").toLowerCase() || "jpg";
  return `${base} - ${seq}.${ext}`;
}

export function buildFolderPath(input: {
  venueFolderSlug: string;
  eventFolderName: string;
}): string {
  return `${sanitizeNamePart(input.venueFolderSlug)}/${sanitizeNamePart(input.eventFolderName)}`;
}

export function extensionFromFileName(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

/** Normalize venue/alias text for matching. */
export function normalizeVenueKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
