/** Pure helpers for the gear-checklist history archive (no I/O, easy to test). */

export const LIVE_WINDOW_DAYS = 90;
export const ARCHIVE_FOLDER_NAME = "Event Checklist History";
export const DEFAULT_BACKUP_DRIVE_ID = "0APCPrc2mft44Uk9PVA";
/** Stop adding rows to one zip once photos pass this size, so a single upload stays small. */
export const MAX_ZIP_BYTES = 40 * 1024 * 1024;
export const MAX_ROWS_PER_ZIP = 500;

export type ArchiveCheckRow = {
  id: string;
  checked_at: string;
  project_name: string;
  event_date: string | null;
  item_name: string;
  pass: "out" | "back";
  qty: number;
  flag: "none" | "damaged" | "missing";
  note: string;
  checked_by_name: string;
  photo_path: string | null;
};

/** Checks newer than this are shown in the live history list. */
export function liveWindowCutoff(now: Date, days: number = LIVE_WINDOW_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * What the daily cron should archive: the year-end run on Dec 31 (everything so far), and a
 * catch-up in the first week of January for anything the year-end run missed (everything before
 * Jan 1). Returns the cutoff (archive checks strictly before it) or null when it is not time.
 */
export function archiveCutoff(now: Date, force = false): Date | null {
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  if (force || (month === 11 && day === 31)) return now;
  if (month === 0 && day <= 7) return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return null;
}

function stamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}`;
}

/** Timestamped so a re-run never overwrites an earlier zip. */
export function archiveFileName(now: Date, part: number): string {
  return `checklist-history-${now.getUTCFullYear()}-${stamp(now)}-part${part}.zip`;
}

/** Name of a photo inside the zip, safe on every file system. */
export function photoFileName(row: Pick<ArchiveCheckRow, "id" | "checked_at">): string {
  return `photos/${row.checked_at.slice(0, 10)}-${row.id}.jpg`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(rows: ArchiveCheckRow[], photoNames: Map<string, string>): string {
  const header = [
    "Checked at (UTC)",
    "Event",
    "Event date",
    "Item",
    "Step",
    "Quantity change",
    "Flag",
    "Note",
    "Checked by",
    "Photo file",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.checked_at,
        r.project_name,
        r.event_date,
        r.item_name,
        r.pass === "out" ? "Out of warehouse" : "Back in warehouse",
        r.qty,
        r.flag === "none" ? "" : r.flag,
        r.note,
        r.checked_by_name,
        photoNames.get(r.id) ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
