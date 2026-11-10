import { INDEPENDENT_CONTRACTOR_AGREEMENT } from "@/lib/documents/agreements/independent-contractor";
import { SUBCONTRACTOR_AGREEMENT } from "@/lib/documents/agreements/subcontractor";
import { TRAINING_AGREEMENT } from "@/lib/documents/agreements/training";
import type {
  AgreementContent,
  AgreementDocumentKey,
  DocumentCatalogEntry,
} from "@/lib/documents/types";

/** Default draft until a hub_documents row exists (same idea as handbook). */
export const AGREEMENT_IS_DRAFT_DEFAULT = true;

export const AGREEMENT_SEEDS: Record<AgreementDocumentKey, AgreementContent> = {
  "independent-contractor": INDEPENDENT_CONTRACTOR_AGREEMENT,
  subcontractor: SUBCONTRACTOR_AGREEMENT,
  training: TRAINING_AGREEMENT,
};

export const AGREEMENT_KEYS = Object.keys(
  AGREEMENT_SEEDS,
) as AgreementDocumentKey[];

export function isAgreementDocumentKey(
  value: string,
): value is AgreementDocumentKey {
  return value in AGREEMENT_SEEDS;
}

export function getAgreementSeed(key: AgreementDocumentKey): AgreementContent {
  return structuredClone(AGREEMENT_SEEDS[key]) as AgreementContent;
}

/** Static catalog (handbook + agreements). Visibility of drafts is applied at load time. */
export const DOCUMENT_CATALOG: DocumentCatalogEntry[] = [
  {
    key: "staff-handbook",
    title: "Staff Handbook",
    description:
      "Policies & procedures for LRE Productions staff — acknowledge after reading.",
    href: "/staff-handbook",
    kind: "handbook",
  },
  {
    key: "independent-contractor",
    title: INDEPENDENT_CONTRACTOR_AGREEMENT.title,
    description:
      "Terms for independent contractors providing entertainment and production services.",
    href: "/documents/independent-contractor",
    kind: "agreement",
    agreementKey: "independent-contractor",
  },
  {
    key: "subcontractor",
    title: SUBCONTRACTOR_AGREEMENT.title,
    description:
      "Subcontractor terms for event entertainment and production engagements.",
    href: "/documents/subcontractor",
    kind: "agreement",
    agreementKey: "subcontractor",
  },
  {
    key: "training",
    title: TRAINING_AGREEMENT.title,
    description:
      "Trainee program expectations, learning objectives, and confidentiality.",
    href: "/documents/training",
    kind: "agreement",
    agreementKey: "training",
  },
];
