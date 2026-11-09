import "server-only";

import { cache } from "react";
import {
  AGREEMENT_IS_DRAFT_DEFAULT,
  AGREEMENT_KEYS,
  getAgreementSeed,
  isAgreementDocumentKey,
} from "@/lib/documents/catalog";
import type {
  AgreementContent,
  AgreementDocumentKey,
  DocumentIconName,
  DocumentSection,
} from "@/lib/documents/types";
import { DOCUMENT_ICON_NAMES } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";

export type LoadedAgreement = {
  key: AgreementDocumentKey;
  content: AgreementContent;
  isDraft: boolean;
  persisted: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length === value.length ? items : undefined;
}

function isIconName(value: string): value is DocumentIconName {
  return (DOCUMENT_ICON_NAMES as readonly string[]).includes(value);
}

/** Soft-parse stored JSON; null if shape is wrong. */
export function parseAgreementContent(
  raw: unknown,
  fallbackKey: AgreementDocumentKey,
): AgreementContent | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.title !== "string") return null;
  if (typeof raw.subtitle !== "string") return null;
  if (typeof raw.acknowledgment !== "string") return null;
  if (typeof raw.companyLine !== "string") return null;
  if (typeof raw.ownerLine !== "string") return null;
  const introduction = asStringArray(raw.introduction);
  if (!introduction) return null;
  if (!Array.isArray(raw.sections)) return null;

  const sections: DocumentSection[] = [];
  for (const section of raw.sections) {
    if (!isRecord(section)) return null;
    if (typeof section.id !== "string") return null;
    if (typeof section.icon !== "string" || !isIconName(section.icon)) {
      return null;
    }
    if (typeof section.title !== "string") return null;
    if (!Array.isArray(section.blocks)) return null;

    const blocks = [];
    for (const block of section.blocks) {
      if (!isRecord(block)) return null;
      blocks.push({
        heading: typeof block.heading === "string" ? block.heading : undefined,
        paragraphs: asStringArray(block.paragraphs),
        items: asStringArray(block.items),
        footnote:
          typeof block.footnote === "string" ? block.footnote : undefined,
      });
    }

    sections.push({
      id: section.id,
      icon: section.icon,
      title: section.title,
      blocks,
    });
  }

  const key =
    typeof raw.key === "string" && isAgreementDocumentKey(raw.key)
      ? raw.key
      : fallbackKey;

  return {
    key,
    title: raw.title,
    subtitle: raw.subtitle,
    introduction,
    acknowledgment: raw.acknowledgment,
    companyLine: raw.companyLine,
    ownerLine: raw.ownerLine,
    sections,
    signButtonLabel:
      typeof raw.signButtonLabel === "string" && raw.signButtonLabel.trim()
        ? raw.signButtonLabel.trim()
        : "Sign Agreement",
  };
}

export const getAgreementDocument = cache(
  async (key: AgreementDocumentKey): Promise<LoadedAgreement> => {
    const seed = getAgreementSeed(key);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hub_documents")
      .select("is_draft, content")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) {
      return {
        key,
        content: seed,
        isDraft: AGREEMENT_IS_DRAFT_DEFAULT,
        persisted: false,
      };
    }

    const parsed = parseAgreementContent(data.content, key);
    return {
      key,
      content: parsed ?? seed,
      isDraft: Boolean(data.is_draft),
      persisted: true,
    };
  },
);

/** Draft status map for catalog cards. Missing rows → default draft. */
export const listAgreementDraftFlags = cache(
  async (): Promise<Record<AgreementDocumentKey, boolean>> => {
    const flags = Object.fromEntries(
      AGREEMENT_KEYS.map((key) => [key, AGREEMENT_IS_DRAFT_DEFAULT]),
    ) as Record<AgreementDocumentKey, boolean>;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hub_documents")
      .select("key, is_draft")
      .in("key", AGREEMENT_KEYS);

    if (error || !data) return flags;

    for (const row of data) {
      const key = String(row.key ?? "");
      if (isAgreementDocumentKey(key)) {
        flags[key] = Boolean(row.is_draft);
      }
    }
    return flags;
  },
);

export async function canViewAgreement(
  key: AgreementDocumentKey,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const doc = await getAgreementDocument(key);
  return !doc.isDraft;
}
