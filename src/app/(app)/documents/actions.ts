"use server";

import { revalidatePath } from "next/cache";
import {
  getAgreementSeed,
  isAgreementDocumentKey,
} from "@/lib/documents/catalog";
import { parseAgreementContent } from "@/lib/documents/settings";
import type {
  AgreementContent,
  AgreementDocumentKey,
  DocumentIconName,
  DocumentSection,
} from "@/lib/documents/types";
import { DOCUMENT_ICON_NAMES } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";

export type SignDocumentInput = {
  documentKey: string;
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
      error: "Only admins can update Hub Documents." as const,
    };
  }
  return { supabase, user, error: null };
}

function isIconName(value: string): value is DocumentIconName {
  return (DOCUMENT_ICON_NAMES as readonly string[]).includes(value);
}

function normalizeContent(
  raw: AgreementContent,
  key: AgreementDocumentKey,
): AgreementContent | string {
  const parsed = parseAgreementContent(raw, key);
  if (!parsed) return "Document content is incomplete or invalid.";
  if (!parsed.title.trim()) return "Title is required.";
  if (!parsed.sections.length) return "Add at least one section.";

  const sections: DocumentSection[] = [];
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
      blocks: section.blocks.map((block) => ({
        ...(block.heading?.trim() ? { heading: block.heading.trim() } : {}),
        ...(block.paragraphs?.length
          ? {
              paragraphs: block.paragraphs.map((p) => p.trim()).filter(Boolean),
            }
          : {}),
        ...(block.items?.length
          ? { items: block.items.map((i) => i.trim()).filter(Boolean) }
          : {}),
        ...(block.footnote?.trim()
          ? { footnote: block.footnote.trim() }
          : {}),
      })),
    });
  }

  return {
    key,
    title: parsed.title.trim(),
    subtitle: parsed.subtitle.trim(),
    introduction: parsed.introduction.map((p) => p.trim()).filter(Boolean),
    acknowledgment: parsed.acknowledgment.trim(),
    companyLine: parsed.companyLine.trim(),
    ownerLine: parsed.ownerLine.trim(),
    sections,
    signButtonLabel: parsed.signButtonLabel.trim() || "Sign Agreement",
  };
}

async function loadRevision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: AgreementDocumentKey,
): Promise<"draft" | "live"> {
  const { data, error } = await supabase
    .from("hub_documents")
    .select("is_draft")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return "draft";
  return data.is_draft ? "draft" : "live";
}

export async function saveAgreementContentAction(
  key: string,
  content: AgreementContent,
  isDraft: boolean,
): Promise<{ error: string | null; content?: AgreementContent }> {
  if (!isAgreementDocumentKey(key)) {
    return { error: "Unknown document." };
  }
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Unauthorized." };

  const normalized = normalizeContent(content, key);
  if (typeof normalized === "string") return { error: normalized };

  const title = normalized.title;
  const { error: upsertError } = await supabase.from("hub_documents").upsert(
    {
      key,
      title,
      is_draft: isDraft,
      content: normalized,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "key" },
  );

  if (upsertError) {
    if (/hub_documents|relation|does not exist/i.test(upsertError.message)) {
      return {
        error:
          "Hub Documents need migration 095_hub_documents.sql in Supabase.",
      };
    }
    return { error: upsertError.message };
  }

  revalidatePath("/documents");
  revalidatePath(`/documents/${key}`);
  return { error: null, content: normalized };
}

export async function setAgreementDraftAction(
  key: string,
  isDraft: boolean,
): Promise<{ error: string | null }> {
  if (!isAgreementDocumentKey(key)) {
    return { error: "Unknown document." };
  }
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Unauthorized." };

  // Ensure a row exists (seed content) before flipping draft flag.
  const { data: existing } = await supabase
    .from("hub_documents")
    .select("key")
    .eq("key", key)
    .maybeSingle();

  if (!existing) {
    const seed = getAgreementSeed(key);
    const { error: insertError } = await supabase.from("hub_documents").insert({
      key,
      title: seed.title,
      is_draft: isDraft,
      content: seed,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });
    if (insertError) {
      if (/hub_documents|relation|does not exist/i.test(insertError.message)) {
        return {
          error:
            "Hub Documents need migration 095_hub_documents.sql in Supabase.",
        };
      }
      return { error: insertError.message };
    }
  } else {
    const { error: updateError } = await supabase
      .from("hub_documents")
      .update({
        is_draft: isDraft,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("key", key);
    if (updateError) return { error: updateError.message };
  }

  revalidatePath("/documents");
  revalidatePath(`/documents/${key}`);
  return { error: null };
}

export async function signDocumentAction(
  input: SignDocumentInput,
): Promise<{ error: string | null }> {
  const key = input.documentKey.trim();
  if (!isAgreementDocumentKey(key)) {
    return { error: "Unknown document." };
  }

  const name = input.signerName.trim();
  const email = input.signerEmail.trim();
  const signature = input.signatureData.trim();
  if (!name) return { error: "Full name is required." };
  if (!signature.startsWith("data:image/")) {
    return { error: "Please draw your signature." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role === "guest") {
    return { error: "Guests cannot sign documents." };
  }

  const revision = await loadRevision(supabase, key);
  // Non-admins can only sign the live (published) revision.
  if (revision === "draft" && profile.role !== "admin") {
    return { error: "This document is still a draft and cannot be signed yet." };
  }

  const { error } = await supabase.from("hub_document_acknowledgements").upsert(
    {
      user_id: user.id,
      document_key: key,
      document_revision: revision,
      signer_name: name,
      signer_email: email,
      signature_data: signature,
      ip_address: input.ipAddress?.trim() || null,
      user_agent: input.userAgent?.trim() || null,
      signed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,document_key,document_revision" },
  );

  if (error) {
    if (
      /hub_document_acknowledgements|relation|does not exist/i.test(
        error.message,
      )
    ) {
      return {
        error:
          "Hub Documents need migration 095_hub_documents.sql in Supabase.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/documents");
  revalidatePath(`/documents/${key}`);
  return { error: null };
}
