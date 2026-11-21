/** Gear tag types (migration 200). */

export type ScanDirection = "out" | "back";
export type ScanFlag = "none" | "damaged" | "missing";
export type OwnerCompany = "vident" | "lukesent" | "lre";

export const OWNER_LABELS: Record<OwnerCompany, string> = {
  vident: "Vident",
  lukesent: "LRE DJs",
  lre: "LRE Productions",
};

export type TaggedUnit = {
  id: string;
  tag: string | null;
  productId: string;
  productName: string;
  label: string;
  serial: string;
  status: "in" | "out" | "retired";
  isCase: boolean;
  caseUnitId: string | null;
  owner: OwnerCompany;
  outProjectId: string | null;
  outProjectName: string;
  outSince: string | null;
};

export type ScanHistoryRow = {
  id: string;
  direction: ScanDirection;
  projectName: string;
  flag: ScanFlag;
  note: string;
  scannedAt: string;
  scannedByName: string;
  viaCase: boolean;
};

export type GearRequestKind = "link_tag" | "add" | "change" | "remove";

export type LinkTagInput = {
  productId: string;
  label: string;
  serial: string;
  isCase: boolean;
  /** Tag number of the case this piece lives in, or "". */
  caseTag: string;
  owner: OwnerCompany | "";
};

export type GearRequest = {
  id: string;
  kind: GearRequestKind;
  tag: string | null;
  unitId: string | null;
  summary: string;
  details: string;
  status: "pending" | "approved" | "declined";
  requestedByName: string;
  requestedAt: string;
  reviewNote: string;
  mine: boolean;
};

export type ProjectOption = { id: string; name: string; date: string | null };
export type ProductOption = { id: string; name: string; owner: OwnerCompany };

export type GearBoard = {
  units: TaggedUnit[];
  products: ProductOption[];
  projects: ProjectOption[];
  requests: GearRequest[];
  isAdmin: boolean;
};

export type ScanResult =
  | {
      ok: true;
      unit: TaggedUnit;
      /** Pieces moved by this scan (more than one for a case). */
      moved: number;
      projectName: string;
      warnings: string[];
    }
  | { ok: false; code: "unlinked"; tag: string; error: string }
  | { ok: false; code: "error"; error: string };
