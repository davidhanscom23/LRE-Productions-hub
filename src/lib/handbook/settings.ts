import { cache } from "react";
import {
  HANDBOOK_CONTENT,
  HANDBOOK_IS_DRAFT_DEFAULT,
  type HandbookContent,
} from "@/lib/handbook/content";
import { createClient } from "@/lib/supabase/server";

export type HandbookDocument = {
  content: HandbookContent;
  isDraft: boolean;
  /** True when a row exists in staff_handbook (vs code defaults). */
  persisted: boolean;
};

function cloneDefaultContent(): HandbookContent {
  return structuredClone(HANDBOOK_CONTENT) as HandbookContent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length === value.length ? items : undefined;
}

/** Soft-parse stored JSON; fall back to defaults if shape is wrong. */
export function parseHandbookContent(raw: unknown): HandbookContent | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.title !== "string") return null;
  if (typeof raw.subtitle !== "string") return null;
  if (typeof raw.mission !== "string") return null;
  if (typeof raw.acknowledgment !== "string") return null;
  if (typeof raw.companyLine !== "string") return null;
  if (typeof raw.ownerLine !== "string") return null;
  const introduction = asStringArray(raw.introduction);
  if (!introduction) return null;
  if (!Array.isArray(raw.sections)) return null;

  const sections = [];
  for (const section of raw.sections) {
    if (!isRecord(section)) return null;
    if (typeof section.id !== "string") return null;
    if (typeof section.icon !== "string") return null;
    if (typeof section.title !== "string") return null;
    if (!Array.isArray(section.blocks)) return null;

    const blocks = [];
    for (const block of section.blocks) {
      if (!isRecord(block)) return null;
      blocks.push({
        heading: typeof block.heading === "string" ? block.heading : undefined,
        paragraphs: asStringArray(block.paragraphs),
        items: asStringArray(block.items),
        footnote: typeof block.footnote === "string" ? block.footnote : undefined,
      });
    }

    sections.push({
      id: section.id,
      icon: section.icon as HandbookContent["sections"][number]["icon"],
      title: section.title,
      blocks,
    });
  }

  return {
    title: raw.title,
    subtitle: raw.subtitle,
    introduction,
    mission: raw.mission,
    acknowledgment: raw.acknowledgment,
    companyLine: raw.companyLine,
    ownerLine: raw.ownerLine,
    sections,
  };
}

/**
 * Load handbook content + draft flag.
 * Before migration / with no row: code defaults (draft).
 * Non-admins cannot read draft rows (RLS) — callers must gate access first.
 */
export const getHandbookDocument = cache(
  async (): Promise<HandbookDocument> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("staff_handbook")
      .select("is_draft, content")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return {
        content: cloneDefaultContent(),
        isDraft: HANDBOOK_IS_DRAFT_DEFAULT,
        persisted: false,
      };
    }

    const parsed = parseHandbookContent(data.content);
    return {
      content: parsed ?? cloneDefaultContent(),
      isDraft: Boolean(data.is_draft),
      persisted: true,
    };
  },
);

/**
 * Whether the current user should see Staff Handbook in nav / Resources.
 * Admins always; others only when published (not draft).
 */
export const canViewStaffHandbook = cache(
  async (isAdmin: boolean): Promise<boolean> => {
    if (isAdmin) return true;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("staff_handbook")
      .select("is_draft")
      .eq("id", 1)
      .maybeSingle();

    // Missing table, RLS-hidden draft, or no row → use code default.
    if (error || !data) {
      return !HANDBOOK_IS_DRAFT_DEFAULT;
    }

    return !data.is_draft;
  },
);
