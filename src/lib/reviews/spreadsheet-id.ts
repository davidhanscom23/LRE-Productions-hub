/** Extract a Google Sheets spreadsheet id from a raw id or docs.google.com URL. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("google.com")) return null;
    const fromPath = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (fromPath?.[1]) return fromPath[1];
    const idParam = url.searchParams.get("id");
    if (idParam && /^[a-zA-Z0-9_-]{20,}$/.test(idParam)) return idParam;
  } catch {
    return null;
  }
  return null;
}
