import type { HandbookBlock } from "@/lib/handbook/content";

export type DocumentIconName =
  | "Briefcase"
  | "Scale"
  | "DollarSign"
  | "AlertTriangle"
  | "Wrench"
  | "Shield"
  | "Users"
  | "Clock"
  | "Megaphone"
  | "FileText"
  | "Camera"
  | "Lock"
  | "Target"
  | "BookOpen"
  | "Lightbulb"
  | "Sparkles"
  | "ClipboardList";

export const DOCUMENT_ICON_NAMES = [
  "Briefcase",
  "Scale",
  "DollarSign",
  "AlertTriangle",
  "Wrench",
  "Shield",
  "Users",
  "Clock",
  "Megaphone",
  "FileText",
  "Camera",
  "Lock",
  "Target",
  "BookOpen",
  "Lightbulb",
  "Sparkles",
  "ClipboardList",
] as const satisfies readonly DocumentIconName[];

export type DocumentSection = {
  id: string;
  icon: DocumentIconName;
  title: string;
  blocks: HandbookBlock[];
};

export type AgreementContent = {
  key: string;
  title: string;
  subtitle: string;
  introduction: string[];
  acknowledgment: string;
  companyLine: string;
  ownerLine: string;
  sections: DocumentSection[];
  signButtonLabel: string;
};

export type AgreementDocumentKey =
  | "independent-contractor"
  | "subcontractor"
  | "training";

export type DocumentCatalogEntry = {
  key: string;
  title: string;
  description: string;
  href: string;
  kind: "handbook" | "agreement";
  agreementKey?: AgreementDocumentKey;
};
