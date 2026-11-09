import "server-only";

import type { AcceptedSignatureMeta } from "@/lib/av-erp/types";
import { createServiceClient } from "@/lib/supabase/admin";

export type { AcceptedSignatureMeta };

export const AV_SIGNED_PDF_BUCKET = "av-opportunity-media";

export function signedPdfStoragePath(input: {
  opportunityId: string;
  docKind: "estimate" | "contract" | "change_order";
  signatureId: string;
}): string {
  return `${input.opportunityId}/signed/${input.docKind}/${input.signatureId}.pdf`;
}

/** Write stamped PDF bytes once (immutable path). Returns storage path or null. */
export async function archiveSignedPdf(input: {
  opportunityId: string;
  docKind: "estimate" | "contract" | "change_order";
  signatureId: string;
  bytes: Uint8Array;
}): Promise<string | null> {
  const supabase = createServiceClient();
  const path = signedPdfStoragePath(input);
  const { error } = await supabase.storage
    .from(AV_SIGNED_PDF_BUCKET)
    .upload(path, input.bytes, {
      contentType: "application/pdf",
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) {
    // Already archived is fine — treat as success.
    if (!/already exists|Duplicate|resource already/i.test(error.message)) {
      console.error("[signed-pdf-archive]", error.message, { path });
      return null;
    }
  }
  await supabase
    .from("av_customer_document_signatures")
    .update({ signed_pdf_storage_path: path })
    .eq("id", input.signatureId);
  return path;
}

/** Download archived signed PDF if present. */
export async function loadArchivedSignedPdf(
  storagePath: string,
): Promise<Uint8Array | null> {
  if (!storagePath.trim()) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(AV_SIGNED_PDF_BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function loadAcceptedSignaturesForOpportunity(
  opportunityId: string,
): Promise<AcceptedSignatureMeta[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("av_customer_document_signatures")
    .select(
      "id, doc_kind, signer_name, signed_at, signed_pdf_emailed_at, signed_pdf_email_to, signed_pdf_storage_path, change_order_id",
    )
    .eq("opportunity_id", opportunityId)
    .eq("response", "accepted")
    .order("signed_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    doc_kind: row.doc_kind as AcceptedSignatureMeta["doc_kind"],
    signer_name: String(row.signer_name ?? ""),
    signed_at: String(row.signed_at),
    signed_pdf_emailed_at: (row.signed_pdf_emailed_at as string | null) ?? null,
    signed_pdf_email_to: String(row.signed_pdf_email_to ?? ""),
    signed_pdf_storage_path: String(
      (row as { signed_pdf_storage_path?: string }).signed_pdf_storage_path ??
        "",
    ),
    change_order_id: (row.change_order_id as string | null) ?? null,
  }));
}
