/** Default client file-request checklist for shared CRM projects. */

export type CrmFileItemKey =
  | "inspiration"
  | "timeline"
  | "floor_plan"
  | "contracts"
  | "other";

export type CrmFileItemDef = {
  key: CrmFileItemKey;
  label: string;
  hint: string;
};

export const CRM_FILE_ITEMS: CrmFileItemDef[] = [
  {
    key: "inspiration",
    label: "Inspiration / mood",
    hint: "Photos, Pinterest boards, or references you love.",
  },
  {
    key: "timeline",
    label: "Timeline / run of day",
    hint: "Draft schedule, ceremony and reception flow.",
  },
  {
    key: "floor_plan",
    label: "Floor plan / layout",
    hint: "Venue layout, seating, or room diagram.",
  },
  {
    key: "contracts",
    label: "Contracts / documents",
    hint: "Signed contracts or other paperwork (optional).",
  },
  {
    key: "other",
    label: "Anything else",
    hint: "Anything that doesn’t fit the other folders.",
  },
];

export const CRM_FILE_BUCKET = "pipeline-project-files";
export const CRM_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const CRM_MAX_FILES_PER_PROJECT = 40;

export function isCrmFileItemKey(v: unknown): v is CrmFileItemKey {
  return CRM_FILE_ITEMS.some((i) => i.key === v);
}

export function crmFileItemLabel(key: string): string {
  return CRM_FILE_ITEMS.find((i) => i.key === key)?.label ?? key;
}

export type CrmProjectFile = {
  id: string;
  project_id: string;
  item_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  storage_path?: string;
};
