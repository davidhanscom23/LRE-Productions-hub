"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { chunkText, embedTexts, isAiConfigured } from "@/lib/kb";
import {
  extractTextFromKnowledgeFile,
  titleFromUploadFileName,
} from "@/lib/kb/extract-document";
import { HUB_FEATURE_ARTICLES } from "@/lib/kb/hub-feature-articles";
import type { KbUploadResult, RebuildResult } from "@/lib/types/kb";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("Admins only");
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Replace chunks for one document. No-ops embeddings if AI isn’t configured. */
async function reindexDocument(
  supabase: SupabaseServer,
  documentId: string,
  content: string,
): Promise<number> {
  await supabase.from("kb_chunks").delete().eq("document_id", documentId);
  const parts = chunkText(content);
  if (parts.length === 0 || !isAiConfigured()) return 0;
  const embeddings = await embedTexts(parts);
  const rows = parts.map((chunk, i) => ({
    document_id: documentId,
    content: chunk,
    embedding: embeddings[i],
  }));
  await supabase.from("kb_chunks").insert(rows);
  return rows.length;
}

/** Upsert product how-to articles from the in-repo hub feature registry. */
async function syncHubGuideDocuments(
  supabase: SupabaseServer,
): Promise<number> {
  await supabase.from("kb_documents").delete().eq("source_type", "hub_guide");
  if (HUB_FEATURE_ARTICLES.length === 0) return 0;

  const rows = HUB_FEATURE_ARTICLES.map((article) => ({
    title: article.title,
    source_type: "hub_guide" as const,
    source_id: article.slug,
    content: `${article.title}\n\n${article.body}`.trim(),
  }));
  await supabase.from("kb_documents").insert(rows);
  return rows.length;
}

export async function addArticle(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("kb_documents")
    .insert({ title, source_type: "article", content: body })
    .select("id")
    .maybeSingle();
  if (data?.id) {
    await reindexDocument(supabase, data.id as string, body);
  }
  revalidatePath("/ask");
}

/**
 * Admin upload: extract text from PDF / Word (.docx) and index it as an article.
 * Scanned image-only PDFs won’t work — they need a text layer.
 */
export async function uploadKnowledgeDocument(
  formData: FormData,
): Promise<KbUploadResult> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Choose a PDF or Word (.docx) file to upload." };
  }

  const extracted = await extractTextFromKnowledgeFile(file);
  if (!extracted.ok) {
    return { ok: false, message: extracted.error };
  }

  const titleOverride = String(formData.get("title") ?? "").trim();
  const title = titleOverride || titleFromUploadFileName(file.name);
  const kindLabel = extracted.kind === "pdf" ? "PDF" : "Word";
  const pageNote =
    extracted.kind === "pdf" && extracted.pageCount
      ? ` (${extracted.pageCount} page${extracted.pageCount === 1 ? "" : "s"})`
      : "";
  const content = `${title}\n\nImported from ${kindLabel} upload${pageNote}.\n\n${extracted.text}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_documents")
    .insert({ title, source_type: "article", content })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return {
      ok: false,
      message:
        error?.message ?? "Couldn’t save that document to the knowledge base.",
    };
  }

  const chunks = await reindexDocument(supabase, data.id as string, content);
  revalidatePath("/ask");

  if (!isAiConfigured()) {
    return {
      ok: true,
      message: `Saved “${title}” from the ${kindLabel}. Add OPENAI_API_KEY and rebuild the index to make it searchable.`,
    };
  }

  return {
    ok: true,
    message: `Indexed “${title}” from the ${kindLabel} into ${chunks} searchable chunk${chunks === 1 ? "" : "s"}. You can edit or delete it in the saved articles list.`,
  };
}

export async function updateArticle(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !title || !body) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("kb_documents")
    .update({ title, content: body })
    .eq("id", id)
    .eq("source_type", "article")
    .select("id")
    .maybeSingle();

  if (data?.id) {
    await reindexDocument(supabase, data.id as string, body);
  }
  revalidatePath("/ask");
}

export async function deleteArticle(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("kb_chunks").delete().eq("document_id", id);
  await supabase
    .from("kb_documents")
    .delete()
    .eq("id", id)
    .eq("source_type", "article");
  revalidatePath("/ask");
}

export async function rebuildIndex(): Promise<RebuildResult> {
  await requireAdmin();
  if (!isAiConfigured()) {
    return {
      ok: false,
      message: "OpenAI key isn’t set yet — add OPENAI_API_KEY and try again.",
      documents: 0,
      chunks: 0,
    };
  }

  const supabase = await createClient();

  // 1) Refresh automatic Hub feature guides from the in-repo hub feature registry.
  const hubGuideCount = await syncHubGuideDocuments(supabase);

  // 2) Refresh "resource" documents from the Resources table (skip admin-only).
  await supabase.from("kb_documents").delete().eq("source_type", "resource");
  const { data: resources } = await supabase
    .from("resources")
    .select("id,title,category,description,visibility")
    .in("visibility", ["everyone", "staff"]);

  const resourceDocs = (resources ?? [])
    .map((r) => ({
      title: String(r.title ?? "Resource"),
      source_type: "resource" as const,
      source_id: r.id as string,
      content: [r.title, r.category, r.description]
        .filter(Boolean)
        .join("\n"),
    }))
    .filter((d) => d.content.trim());
  if (resourceDocs.length) {
    await supabase.from("kb_documents").insert(resourceDocs);
  }

  // 2b) Index Vendors directory for Ask the Hub (who do we use for…?).
  await supabase.from("kb_documents").delete().eq("source_type", "vendor");
  const { data: vendors } = await supabase
    .from("vendors")
    .select(
      "id, category, company_name, contact_name, phone, email, website, notes, preferred, departments",
    );
  const { vendorToKbContent } = await import("@/lib/vendors/types");
  const vendorDocs = (vendors ?? []).map((v) => ({
    title: `Vendor — ${String(v.company_name ?? "Vendor")}`,
    source_type: "vendor" as const,
    source_id: v.id as string,
    content: vendorToKbContent(v as import("@/lib/vendors/types").Vendor),
  }));
  if (vendorDocs.length) {
    await supabase.from("kb_documents").insert(vendorDocs);
  }

  // 3) Re-embed every non-Drive document (hub guides + resources + vendors + custom).
  // Drive files are owned by syncDriveKnowledgeBase / nightly cron — skip here to
  // avoid double OpenAI cost on every Rebuild.
  const { data: docs } = await supabase
    .from("kb_documents")
    .select("id,content")
    .neq("source_type", "drive");

  let chunkCount = 0;
  for (const doc of docs ?? []) {
    chunkCount += await reindexDocument(
      supabase,
      doc.id as string,
      String(doc.content ?? ""),
    );
  }

  const { count: driveCount } = await supabase
    .from("kb_documents")
    .select("id", { count: "exact", head: true })
    .eq("source_type", "drive");

  revalidatePath("/ask");
  return {
    ok: true,
    message: `Indexed ${docs?.length ?? 0} Hub documents (${hubGuideCount} hub guides) into ${chunkCount} chunks.${
      driveCount
        ? ` ${driveCount} Drive file(s) stay searchable — use Sync Drive (or the nightly cron) to refresh them.`
        : " Use Sync Drive to index Google Docs/Sheets/PDF/DOCX from the company Drive folder."
    }`,
    documents: (docs?.length ?? 0) + (driveCount ?? 0),
    chunks: chunkCount,
  };
}

/** Admin: crawl Hub Drive root and index Docs/Sheets/PDF/DOCX into Ask. */
export async function syncDriveIndex(): Promise<{
  ok: boolean;
  message: string;
}> {
  await requireAdmin();
  const { syncDriveKnowledgeBase } = await import("@/lib/kb/drive-sync");
  const result = await syncDriveKnowledgeBase({ maxFiles: 80 });
  revalidatePath("/ask");
  if (result.error) {
    return { ok: false, message: result.error };
  }
  return {
    ok: true,
    message: `Drive sync: listed ${result.listed}, indexed/updated ${result.upserted}, skipped ${result.skipped}, removed ${result.deleted}.`,
  };
}
