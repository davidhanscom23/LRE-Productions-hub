"use server";

import { revalidatePath } from "next/cache";
import {
  validateCustomerEsign,
  type CustomerDocKind,
} from "@/lib/av-erp/customer-esign";
import { ESTIMATE_TOKEN_RE } from "@/lib/av-erp/public-estimate";
import { createServiceClient } from "@/lib/supabase/admin";

export type EstimateRespondResult =
  | { ok: true; response: "accepted" | "declined"; docKind: CustomerDocKind }
  | { ok: false; error: string };

type RespondInput = {
  token: string;
  docKind: "estimate" | "contract";
  response: "accepted" | "declined";
  note?: string;
  signerName?: string;
  signerEmail?: string;
  signatureData?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function respondToPublicEstimateAction(
  input: RespondInput,
): Promise<EstimateRespondResult> {
  const token = String(input.token ?? "").trim();
  if (!ESTIMATE_TOKEN_RE.test(token)) {
    return { ok: false, error: "Invalid estimate link." };
  }
  if (input.docKind !== "estimate" && input.docKind !== "contract") {
    return { ok: false, error: "Unknown document type." };
  }

  const validated = validateCustomerEsign(input);
  if (!validated.ok) return validated;

  const supabase = createServiceClient();
  const { data: opp, error } = await supabase
    .from("av_opportunities")
    .select(
      "id, share_enabled, status, estimate_response, contract_response",
    )
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  if (error) {
    if (/contract_response|column/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Customer e-sign needs migration 152_av_customer_esign.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }
  if (!opp) return { ok: false, error: "Estimate not found or link revoked." };

  if (input.docKind === "estimate") {
    if (opp.estimate_response) {
      return {
        ok: false,
        error: `This estimate was already ${opp.estimate_response}.`,
      };
    }
  } else {
    if (opp.contract_response) {
      return {
        ok: false,
        error: `This contract was already ${opp.contract_response}.`,
      };
    }
    // Contract signing requires a prior accepted estimate (or already Order).
    if (opp.estimate_response !== "accepted" && opp.status !== "order") {
      return {
        ok: false,
        error: "Accept the estimate before signing the contract.",
      };
    }
  }

  const v = validated.value;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (input.docKind === "estimate") {
    patch.estimate_response = v.response;
    patch.estimate_responded_at = now;
    patch.estimate_response_note = v.note;
    patch.estimate_signer_name =
      v.response === "accepted" ? v.signerName : "";
    if (v.response === "accepted" && opp.status === "quotation") {
      patch.status = "order";
    }
  } else {
    patch.contract_response = v.response;
    patch.contract_responded_at = now;
    patch.contract_response_note = v.note;
    patch.contract_signer_name =
      v.response === "accepted" ? v.signerName : "";
  }

  const { error: updateError } = await supabase
    .from("av_opportunities")
    .update(patch)
    .eq("id", opp.id);
  if (updateError) {
    if (/estimate_signer_name|contract_response|column/i.test(updateError.message)) {
      return {
        ok: false,
        error:
          "Customer e-sign needs migration 152_av_customer_esign.sql in Supabase.",
      };
    }
    return { ok: false, error: updateError.message };
  }

  const { data: sigRow, error: sigError } = await supabase
    .from("av_customer_document_signatures")
    .insert({
      opportunity_id: opp.id,
      change_order_id: null,
      doc_kind: input.docKind,
      response: v.response,
      signer_name: v.signerName,
      signer_email: v.signerEmail,
      signature_data: v.signatureData,
      response_note: v.note,
      ip_address: v.ipAddress,
      user_agent: v.userAgent,
      share_token_used: token,
      signed_at: now,
    })
    .select("id")
    .maybeSingle();
  if (sigError) {
    // Opportunity already updated — surface migration/table issues clearly.
    if (/av_customer_document_signatures|relation|does not exist/i.test(sigError.message)) {
      return {
        ok: false,
        error:
          "Customer e-sign needs migration 152_av_customer_esign.sql in Supabase.",
      };
    }
    return { ok: false, error: sigError.message };
  }

  if (v.response === "accepted" && sigRow?.id) {
    const { emailSignedDocumentCopy } = await import(
      "@/lib/av-erp/signed-document-email"
    );
    // Best-effort: never fail the accept if email/PDF stamp fails.
    void emailSignedDocumentCopy({
      opportunityId: opp.id,
      docKind: input.docKind,
      signatureId: sigRow.id,
    });
  }

  revalidatePath(`/estimate/${token}`);
  revalidatePath(`/rentals/quotes/${opp.id}`);
  revalidatePath("/rentals/quotes");
  return { ok: true, response: v.response, docKind: input.docKind };
}
