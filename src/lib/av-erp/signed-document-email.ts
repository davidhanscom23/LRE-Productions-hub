import "server-only";

import { rmsDocumentFromEstimate } from "@/lib/av-erp/documents/from-estimate";
import {
  buildRmsDocumentPdf,
  rmsDocumentFileName,
} from "@/lib/av-erp/documents/rms-document-pdf";
import type { RmsDocument } from "@/lib/av-erp/documents/types";
import { loadChangeOrderByToken } from "@/lib/av-erp/change-orders";
import { loadCustomerEstimateByOpportunityId } from "@/lib/av-erp/public-estimate";
import { COMPANY } from "@/lib/company";
import { sendEmailDetailed } from "@/lib/email/send";
import { createServiceClient } from "@/lib/supabase/admin";
import { changeOrderAmountDelta } from "@/lib/av-erp/change-order-lines";
import type { ChangeOrderLineInput } from "@/lib/av-erp/change-order-lines";
import {
  archiveSignedPdf,
  loadArchivedSignedPdf,
} from "@/lib/av-erp/signed-pdf-archive";

type Stamp = {
  signerName: string;
  signedAt: string;
  imageDataUrl: string;
  signerEmail?: string;
};

async function loadStamp(
  opportunityId: string,
  docKind: "estimate" | "contract",
): Promise<Stamp | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("av_customer_document_signatures")
    .select(
      "signer_name, signer_email, signature_data, signed_at, response",
    )
    .eq("opportunity_id", opportunityId)
    .eq("doc_kind", docKind)
    .eq("response", "accepted")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.signature_data?.startsWith("data:image/")) return null;
  return {
    signerName: data.signer_name || "",
    signedAt: data.signed_at,
    imageDataUrl: data.signature_data,
    signerEmail: data.signer_email || "",
  };
}

async function customerEmailForOpportunity(
  opportunityId: string,
): Promise<{ to: string; name: string } | null> {
  const supabase = createServiceClient();
  const { data: opp } = await supabase
    .from("av_opportunities")
    .select("customer_id, reference")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp?.customer_id) return null;
  const { data: customer } = await supabase
    .from("av_customers")
    .select("name, email")
    .eq("id", opp.customer_id)
    .maybeSingle();
  const to = String(customer?.email ?? "")
    .trim()
    .toLowerCase();
  if (!to.includes("@")) return null;
  return { to, name: customer?.name ?? "" };
}

function withStamp(
  doc: RmsDocument,
  stamp: Stamp | null,
): RmsDocument {
  if (!stamp) return doc;
  return {
    ...doc,
    showSignature: true,
    signatureStamp: {
      signerName: stamp.signerName,
      signedAt: stamp.signedAt,
      imageDataUrl: stamp.imageDataUrl,
    },
  };
}

async function signatureStoragePath(
  signatureId: string | undefined,
): Promise<string> {
  if (!signatureId) return "";
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("av_customer_document_signatures")
    .select("signed_pdf_storage_path")
    .eq("id", signatureId)
    .maybeSingle();
  return String(
    (data as { signed_pdf_storage_path?: string } | null)
      ?.signed_pdf_storage_path ?? "",
  );
}

async function latestAcceptedSignatureId(
  opportunityId: string,
  docKind: "estimate" | "contract",
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("av_customer_document_signatures")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .eq("doc_kind", docKind)
    .eq("response", "accepted")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Build stamped estimate/contract PDF bytes for an opportunity. */
export async function buildStampedOpportunityPdf(
  opportunityId: string,
  docKind: "estimate" | "contract",
  options?: { preferArchive?: boolean; signatureId?: string },
): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  const estimate = await loadCustomerEstimateByOpportunityId(opportunityId);
  if (!estimate) return null;

  const fileName =
    docKind === "estimate"
      ? rmsDocumentFileName(rmsDocumentFromEstimate(estimate, "estimate"))
      : rmsDocumentFileName(rmsDocumentFromEstimate(estimate, "contract"));

  const signatureId =
    options?.signatureId ??
    (await latestAcceptedSignatureId(opportunityId, docKind));

  if (options?.preferArchive !== false && signatureId) {
    const path = await signatureStoragePath(signatureId);
    if (path) {
      const archived = await loadArchivedSignedPdf(path);
      if (archived) return { bytes: archived, fileName };
    }
  }

  const stamp = await loadStamp(opportunityId, docKind);
  const doc =
    docKind === "estimate"
      ? withStamp(rmsDocumentFromEstimate(estimate, "estimate"), stamp)
      : withStamp(rmsDocumentFromEstimate(estimate, "contract"), stamp);
  const bytes = await buildRmsDocumentPdf(doc);

  if (signatureId && stamp) {
    await archiveSignedPdf({
      opportunityId,
      docKind,
      signatureId,
      bytes,
    });
  }

  return { bytes, fileName: rmsDocumentFileName(doc) };
}

async function markSignedPdfEmailed(
  signatureId: string | undefined,
  to: string,
): Promise<void> {
  if (!signatureId) return;
  const supabase = createServiceClient();
  await supabase
    .from("av_customer_document_signatures")
    .update({
      signed_pdf_emailed_at: new Date().toISOString(),
      signed_pdf_email_to: to,
    })
    .eq("id", signatureId);
}

/** Email stamped signed PDF after customer accept (best-effort). */
export async function emailSignedDocumentCopy(input: {
  opportunityId: string;
  docKind: "estimate" | "contract";
  signatureId?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const recipient = await customerEmailForOpportunity(input.opportunityId);
  if (!recipient) {
    return { ok: false, skipped: true, error: "No customer email." };
  }
  const pdf = await buildStampedOpportunityPdf(
    input.opportunityId,
    input.docKind,
    { signatureId: input.signatureId, preferArchive: true },
  );
  if (!pdf) return { ok: false, error: "Could not build signed PDF." };

  const label = input.docKind === "estimate" ? "estimate" : "contract";
  const sent = await sendEmailDetailed({
    to: recipient.to,
    subject: `Signed ${label} — ${COMPANY.displayName}`,
    text: [
      `Hi${recipient.name ? ` ${recipient.name}` : ""},`,
      "",
      `Attached is your signed ${label} from ${COMPANY.displayName}.`,
      "",
      `— ${COMPANY.displayName}`,
    ].join("\n"),
    html: `<p>Hi${recipient.name ? ` ${recipient.name}` : ""},</p>
<p>Attached is your signed ${label} from ${COMPANY.displayName}.</p>
<p>— ${COMPANY.displayName}</p>`,
    attachments: [
      {
        filename: pdf.fileName,
        content: pdf.bytes,
        contentType: "application/pdf",
      },
    ],
  });

  if (sent.ok) {
    await markSignedPdfEmailed(input.signatureId, recipient.to);
  }

  return sent;
}

async function buildChangeOrderSignedPdf(input: {
  changeOrderId: string;
  token: string;
  signatureId?: string;
}): Promise<{
  bytes: Uint8Array;
  fileName: string;
  opportunityId: string;
  number: string;
} | null> {
  const co = await loadChangeOrderByToken(input.token);
  if (!co) return null;

  const supabase = createServiceClient();
  const signatureId = input.signatureId;
  if (signatureId) {
    const path = await signatureStoragePath(signatureId);
    if (path) {
      const archived = await loadArchivedSignedPdf(path);
      if (archived) {
        const stub: RmsDocument = {
          kind: "contract",
          reference: co.number,
          subject: co.subject || `Change order for ${co.opportunity_reference}`,
          statusLabel: co.status,
          client: null,
          venue: null,
          gearStartsAt: null,
          gearEndsAt: null,
          chargeStartsAt: null,
          chargeEndsAt: null,
          sections: [],
          linesSubtotal: 0,
          surchargeAmount: 0,
          discountAmount: 0,
          taxAmount: 0,
          total: 0,
          amountPaid: 0,
          amountCredited: 0,
          notes: "",
          transportNotes: "",
          terms: "",
          showSignature: true,
        };
        return {
          bytes: archived,
          fileName: rmsDocumentFileName(stub),
          opportunityId: co.opportunity_id,
          number: co.number,
        };
      }
    }
  }

  const { data: lines } = await supabase
    .from("av_change_order_lines")
    .select(
      "id, change_order_id, source_line_id, product_id, service_id, description, qty, unit_price, discount_pct, sort_order, text_kind, apply_mode, created_at",
    )
    .eq("change_order_id", input.changeOrderId)
    .order("sort_order");

  const { data: sig } = await supabase
    .from("av_customer_document_signatures")
    .select("signer_name, signature_data, signed_at, signer_email")
    .eq("change_order_id", input.changeOrderId)
    .eq("response", "accepted")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const coLines = (lines ?? []) as ChangeOrderLineInput[];
  const delta = changeOrderAmountDelta(coLines);
  const stamp =
    sig?.signature_data?.startsWith("data:image/")
      ? {
          signerName: sig.signer_name || "",
          signedAt: sig.signed_at,
          imageDataUrl: sig.signature_data,
        }
      : null;

  const doc: RmsDocument = {
    kind: "contract",
    reference: co.number,
    subject: co.subject || `Change order for ${co.opportunity_reference}`,
    statusLabel: co.status,
    client: co.customer_name
      ? { name: co.customer_name, lines: [] }
      : null,
    venue: null,
    gearStartsAt: null,
    gearEndsAt: null,
    chargeStartsAt: null,
    chargeEndsAt: null,
    sections: [
      {
        name: "Change order lines",
        lines: (lines ?? []).map((l) => ({
          id: l.id as string,
          typeLabel: String(l.apply_mode || "add"),
          description: String(l.description || ""),
          qty: Number(l.qty) || 0,
          unitPrice: Number(l.unit_price) || 0,
          lineTotal:
            Math.round(
              (Math.max(0, Number(l.qty) || 0) * (Number(l.unit_price) || 0) +
                Number.EPSILON) *
                100,
            ) / 100,
        })),
      },
    ],
    linesSubtotal: delta,
    surchargeAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: delta,
    amountPaid: 0,
    amountCredited: 0,
    notes: co.summary || "",
    transportNotes: "",
    terms: "",
    showSignature: true,
    signatureStamp: stamp,
  };

  const bytes = await buildRmsDocumentPdf(doc);
  const fileName = rmsDocumentFileName(doc);

  if (signatureId && stamp) {
    await archiveSignedPdf({
      opportunityId: co.opportunity_id,
      docKind: "change_order",
      signatureId,
      bytes,
    });
  }

  return {
    bytes,
    fileName,
    opportunityId: co.opportunity_id,
    number: co.number,
  };
}

/** Build + email stamped change-order PDF after accept. */
export async function emailSignedChangeOrderCopy(input: {
  changeOrderId: string;
  token: string;
  signatureId?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const pdf = await buildChangeOrderSignedPdf(input);
  if (!pdf) return { ok: false, error: "Change order not found." };

  const recipient = await customerEmailForOpportunity(pdf.opportunityId);
  if (!recipient) {
    return { ok: false, skipped: true, error: "No customer email." };
  }

  const sent = await sendEmailDetailed({
    to: recipient.to,
    subject: `Signed change order ${pdf.number} — ${COMPANY.displayName}`,
    text: [
      `Hi${recipient.name ? ` ${recipient.name}` : ""},`,
      "",
      `Attached is your signed change order ${pdf.number} from ${COMPANY.displayName}.`,
      "",
      `— ${COMPANY.displayName}`,
    ].join("\n"),
    html: `<p>Hi${recipient.name ? ` ${recipient.name}` : ""},</p>
<p>Attached is your signed change order <strong>${pdf.number}</strong>.</p>
<p>— ${COMPANY.displayName}</p>`,
    attachments: [
      {
        filename: pdf.fileName,
        content: pdf.bytes,
        contentType: "application/pdf",
      },
    ],
  });

  if (sent.ok) {
    await markSignedPdfEmailed(input.signatureId, recipient.to);
  }

  return sent;
}

/** Staff/public PDF download with e-sign stamp when already accepted. */
export async function stampEstimateOrContractPdf(
  opportunityId: string,
  kind: "estimate" | "contract",
): Promise<Uint8Array> {
  const built = await buildStampedOpportunityPdf(opportunityId, kind, {
    preferArchive: true,
  });
  if (!built) throw new Error("Estimate not found.");
  return built.bytes;
}

/** Resend an already-accepted signed PDF by signature row id. */
export async function resendSignedPdfBySignatureId(
  signatureId: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string; to?: string }> {
  const supabase = createServiceClient();
  const { data: sig } = await supabase
    .from("av_customer_document_signatures")
    .select(
      "id, opportunity_id, change_order_id, doc_kind, response, signed_pdf_storage_path",
    )
    .eq("id", signatureId)
    .maybeSingle();
  if (!sig || sig.response !== "accepted") {
    return { ok: false, error: "Accepted signature not found." };
  }

  const docKind = sig.doc_kind as "estimate" | "contract" | "change_order";
  if (docKind === "change_order") {
    if (!sig.change_order_id) {
      return { ok: false, error: "Change order missing on signature." };
    }
    const { data: co } = await supabase
      .from("av_change_orders")
      .select("share_token")
      .eq("id", sig.change_order_id)
      .maybeSingle();
    const token = String(co?.share_token ?? "");
    if (!token) {
      return { ok: false, error: "Change order share token missing." };
    }
    const sent = await emailSignedChangeOrderCopy({
      changeOrderId: sig.change_order_id as string,
      token,
      signatureId,
    });
    if (!sent.ok) return sent;
    const recipient = await customerEmailForOpportunity(
      sig.opportunity_id as string,
    );
    return { ok: true, to: recipient?.to };
  }

  const sent = await emailSignedDocumentCopy({
    opportunityId: sig.opportunity_id as string,
    docKind,
    signatureId,
  });
  if (!sent.ok) return sent;
  const recipient = await customerEmailForOpportunity(
    sig.opportunity_id as string,
  );
  return { ok: true, to: recipient?.to };
}
