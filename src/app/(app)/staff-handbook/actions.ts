"use server";

import { revalidatePath } from "next/cache";
import {
  HANDBOOK_ICON_NAMES,
  type HandbookBlock,
  type HandbookContent,
  type HandbookIconName,
  type HandbookSection,
} from "@/lib/handbook/content";
import { parseHandbookContent } from "@/lib/handbook/settings";
import { createClient } from "@/lib/supabase/server";

export type SignHandbookInput = {
  signerName: string;
  signerEmail: string;
  signatureData: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "You must be signed in." as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return {
      supabase,
      user: null,
      error: "Only admins can update the Staff Handbook." as const,
    };
  }

  return { supabase, user, error: null };
}

function isIconName(value: string): value is HandbookIconName {
  return (HANDBOOK_ICON_NAMES as readonly string[]).includes(value);
}

function normalizeBlock(block: HandbookBlock): HandbookBlock {
  const paragraphs = block.paragraphs
    ?.map((p) => p.trim())
    .filter(Boolean);
  const items = block.items?.map((item) => item.trim()).filter(Boolean);
  const heading = block.heading?.trim() || undefined;
  const footnote = block.footnote?.trim() || undefined;

  return {
    ...(heading ? { heading } : {}),
    ...(paragraphs?.length ? { paragraphs } : {}),
    ...(items?.length ? { items } : {}),
    ...(footnote ? { footnote } : {}),
  };
}

function normalizeContent(raw: HandbookContent): HandbookContent | string {
  const parsed = parseHandbookContent(raw);
  if (!parsed) return "Handbook content is incomplete or invalid.";

  if (!parsed.title.trim()) return "Title is required.";
  if (!parsed.sections.length) return "Add at least one section.";

  const sections: HandbookSection[] = [];
  for (const section of parsed.sections) {
    const title = section.title.trim();
    if (!title) return "Every section needs a title.";
    if (!isIconName(section.icon)) {
      return `Unknown icon “${section.icon}” on section “${title}”.`;
    }
    const id =
      section.id.trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      `section-${sections.length + 1}`;

    sections.push({
      id,
      icon: section.icon,
      title,
      blocks: section.blocks.map(normalizeBlock),
    });
  }

  return {
    title: parsed.title.trim(),
    subtitle: parsed.subtitle.trim(),
    introduction: parsed.introduction.map((p) => p.trim()).filter(Boolean),
    mission: parsed.mission.trim(),
    acknowledgment: parsed.acknowledgment.trim(),
    companyLine: parsed.companyLine.trim(),
    ownerLine: parsed.ownerLine.trim(),
    sections,
  };
}

async function loadRevision(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<"draft" | "live"> {
  const { data, error } = await supabase
    .from("staff_handbook")
    .select("is_draft")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return "draft";
  return data.is_draft ? "draft" : "live";
}

export async function signHandbookAction(
  input: SignHandbookInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const name = input.signerName.trim();
  if (!name) return { error: "Full name is required." };
  if (!input.signatureData?.startsWith("data:image/")) {
    return { error: "A drawn signature is required." };
  }

  const revision = await loadRevision(supabase);

  const { error } = await supabase.from("handbook_acknowledgements").upsert(
    {
      user_id: user.id,
      signer_name: name,
      signer_email: input.signerEmail.trim(),
      signature_data: input.signatureData,
      ip_address: input.ipAddress?.trim() || null,
      user_agent: input.userAgent?.slice(0, 240) || null,
      handbook_revision: revision,
      signed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,handbook_revision" },
  );

  if (error) {
    const message = error.message ?? "Could not save signature.";
    if (
      /handbook_acknowledgements/i.test(message) &&
      /schema cache|does not exist|could not find the table/i.test(message)
    ) {
      return {
        error:
          "Staff Handbook signatures need a database update. Run migration 044_fix_handbook_acknowledgements.sql in Supabase, then try again.",
      };
    }
    return { error: message };
  }

  try {
    const { awardAchievement } = await import("@/lib/points/hub-points");
    await awardAchievement(supabase, "handbook_signed", {
      handbook_revision: revision,
    });
  } catch {
    // non-critical
  }

  revalidatePath("/staff-handbook");
  return { error: null };
}

export async function saveHandbookContentAction(
  content: HandbookContent,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "You must be signed in." };

  const normalized = normalizeContent(content);
  if (typeof normalized === "string") return { error: normalized };

  const { data: existing } = await supabase
    .from("staff_handbook")
    .select("is_draft")
    .eq("id", 1)
    .maybeSingle();

  const isDraft = existing ? Boolean(existing.is_draft) : true;

  const { error: upsertError } = await supabase.from("staff_handbook").upsert(
    {
      id: 1,
      is_draft: isDraft,
      content: normalized,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "id" },
  );

  if (upsertError) return { error: upsertError.message };

  revalidatePath("/staff-handbook");
  revalidatePath("/resources");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function setHandbookDraftAction(
  isDraft: boolean,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "You must be signed in." };

  const { data: existing } = await supabase
    .from("staff_handbook")
    .select("content")
    .eq("id", 1)
    .maybeSingle();

  if (!existing) {
    return {
      error:
        "Save the handbook once before publishing. That stores your edits in the database.",
    };
  }

  const { error: updateError } = await supabase
    .from("staff_handbook")
    .update({
      is_draft: isDraft,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", 1);

  if (updateError) return { error: updateError.message };

  revalidatePath("/staff-handbook");
  revalidatePath("/resources");
  revalidatePath("/", "layout");
  return { error: null };
}
