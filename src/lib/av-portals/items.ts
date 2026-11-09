/**
 * AV event portal checklist ("cue sheet"): the six things every show needs,
 * how uploads get matched to them, and how readiness is computed.
 * Pure functions only, so this is safe to import from client components.
 */

export type ItemKey =
  | "floor_plan"
  | "run_of_show"
  | "headcount"
  | "day_of_contact"
  | "load_in"
  | "presentation";

export type FileItemKey = "floor_plan" | "run_of_show" | "load_in" | "presentation";
export type StoredFileKey = FileItemKey | "other";
export type ValueItemKey = "headcount" | "day_of_contact" | "load_in";

export type ItemDef = {
  key: ItemKey;
  label: string;
  hint: string;
  /** How the client satisfies the item. */
  input: "file" | "number" | "contact" | "text_or_file";
};

export const PORTAL_ITEMS: ItemDef[] = [
  { key: "floor_plan", label: "Floor plan or room diagram", hint: "Room layout, screens, speakers and staging.", input: "file" },
  { key: "run_of_show", label: "Event timeline / run of show", hint: "Timing, transitions and every important cue.", input: "file" },
  { key: "headcount", label: "Final headcount", hint: "The number of guests expected.", input: "number" },
  { key: "day_of_contact", label: "Day-of contact", hint: "Name and cell number for the on-site contact.", input: "contact" },
  { key: "load_in", label: "Load-in, dock & parking", hint: "Arrival instructions and access for the crew.", input: "text_or_file" },
  { key: "presentation", label: "Presentation files", hint: "Slides, videos, graphics and other show media.", input: "file" },
];

export const FILE_ITEM_KEYS: FileItemKey[] = ["floor_plan", "run_of_show", "load_in", "presentation"];
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_PORTAL = 60;

export const FILE_KEY_LABEL: Record<StoredFileKey, string> = {
  floor_plan: "Floor plan",
  run_of_show: "Run of show",
  load_in: "Load-in info",
  presentation: "Presentation files",
  other: "Anything else",
};

export function isStoredFileKey(v: unknown): v is StoredFileKey {
  return v === "other" || FILE_ITEM_KEYS.includes(v as FileItemKey);
}

/** Guess which checklist item an uploaded file belongs to from its name/type. */
export function classifyFile(fileName: string, mimeType = ""): StoredFileKey {
  const name = fileName.toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";
  const spaced = name.replace(/[_\-.]+/g, " ");

  if (/(run ?of ?show|\bros\b|timeline|cue ?sheet|agenda|schedule|itinerary|program flow|show flow)/.test(spaced)) {
    return "run_of_show";
  }
  if (/(floor ?plan|room ?(layout|diagram|setup|set up)|seating|stage ?(plot|plan)|site ?plan|layout|diagram|\bplot\b)/.test(spaced)) {
    return "floor_plan";
  }
  if (/(load ?in|loading ?dock|\bdock\b|parking|truck|site ?access)/.test(spaced)) {
    return "load_in";
  }
  if (
    ["ppt", "pptx", "pps", "ppsx", "key", "odp", "mp4", "mov", "m4v", "avi", "mkv", "wmv"].includes(ext) ||
    mimeType.startsWith("video/") ||
    /(slides?|deck|presentation|keynote|powerpoint|\bloop\b|video|graphics?|logo|sponsor)/.test(spaced)
  ) {
    return "presentation";
  }
  return "other";
}

export type PortalValues = Partial<Record<ValueItemKey, unknown>>;
export type PortalFileLite = { id: string; item_key: StoredFileKey; file_name: string };

export type ContactValue = { name: string; phone: string };

export function parseHeadcount(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : null;
}

export function parseContact(raw: unknown): ContactValue | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone.trim() : "";
  if (name.length < 2 || name.length > 120) return null;
  if (phone.replace(/\D/g, "").length < 7 || phone.length > 40) return null;
  return { name, phone };
}

export function parseLoadInText(raw: unknown): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t.length >= 3 && t.length <= 4000 ? t : null;
}

export type ItemStatus = {
  def: ItemDef;
  complete: boolean;
  /** How it was satisfied. */
  via: "file" | "typed" | null;
  fileNames: string[];
  display: string;
};

export type PortalStatus = {
  items: ItemStatus[];
  completeCount: number;
  total: number;
  allComplete: boolean;
  missing: ItemDef[];
};

export function computeStatus(values: PortalValues, files: PortalFileLite[]): PortalStatus {
  const items: ItemStatus[] = PORTAL_ITEMS.map((def) => {
    const itemFiles = files.filter((f) => f.item_key === def.key).map((f) => f.file_name);
    let typed: string | null = null;
    if (def.key === "headcount") {
      const n = parseHeadcount(values.headcount);
      if (n !== null) typed = `${n} guests`;
    } else if (def.key === "day_of_contact") {
      const c = parseContact(values.day_of_contact);
      if (c) typed = `${c.name} · ${c.phone}`;
    } else if (def.key === "load_in") {
      const t = parseLoadInText(values.load_in);
      if (t) typed = t;
    }
    const hasFile = itemFiles.length > 0 && def.input !== "number" && def.input !== "contact";
    const via = hasFile ? "file" : typed ? "typed" : null;
    return {
      def,
      complete: via !== null,
      via,
      fileNames: itemFiles,
      display: hasFile ? itemFiles.join(", ") : typed ?? "",
    };
  });
  const completeCount = items.filter((i) => i.complete).length;
  return {
    items,
    completeCount,
    total: items.length,
    allComplete: completeCount === items.length,
    missing: items.filter((i) => !i.complete).map((i) => i.def),
  };
}
