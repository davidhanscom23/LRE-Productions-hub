"use server";

import { revalidatePath } from "next/cache";
import { validateCustomerEsign } from "@/lib/av-erp/customer-esign";
import { ESTIMATE_TOKEN_RE } from "@/lib/av-erp/public-estimate";
import { createServiceClient } from "@/lib/supabase/admin";

export type ChangeOrderRespondResult =
  | { ok: true; response: "accepted" | "declined" }
  | { ok: false; error: string };

export async function respondToPublicChangeOrderAction(input: {
  token: string;
  response: "accepted" | "declined";
  note?: string;
  signerName?: string;
  signerEmail?: string;
  signatureData?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ChangeOrderRespondResult> {
  const token = String(input.token ?? "").trim();
  if (!ESTIMATE_TOKEN_RE.test(token)) {
    return { ok: false, error: "Invalid change order link." };
  }

  const validated = validateCustomerEsign(input);
  if (!validated.ok) return validated;

  const supabase = createServiceClient();
  const { data: co, error } = await supabase
    .from("av_change_orders")
    .select(
      "id, opportunity_id, status, share_enabled, number",
    )
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  if (error) {
    if (/av_change_orders|relation|does not exist/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Change orders need migration 152_av_customer_esign.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }
  if (!co) {
    return { ok: false, error: "Change order not found or link revoked." };
  }
  if (co.status === "accepted" || co.status === "declined") {
    return { ok: false, error: `This change order was already ${co.status}.` };
  }
  if (co.status === "void") {
    return { ok: false, error: "This change order is void." };
  }

  const v = validated.value;
  const now = new Date().toISOString();
  const nextStatus = v.response === "accepted" ? "accepted" : "declined";

  const { error: updateError } = await supabase
    .from("av_change_orders")
    .update({
      status: nextStatus,
      response_note: v.note,
      signer_name: v.response === "accepted" ? v.signerName : "",
      responded_at: now,
      updated_at: now,
    })
    .eq("id", co.id);
  if (updateError) return { ok: false, error: updateError.message };

  const { data: sigRow, error: sigError } = await supabase
    .from("av_customer_document_signatures")
    .insert({
      opportunity_id: co.opportunity_id,
      change_order_id: co.id,
      doc_kind: "change_order",
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
    if (/av_customer_document_signatures|relation|does not exist/i.test(sigError.message)) {
      return {
        ok: false,
        error:
          "Customer e-sign needs migration 152_av_customer_esign.sql in Supabase.",
      };
    }
    return { ok: false, error: sigError.message };
  }

  if (v.response === "accepted") {
    const { applyChangeOrderLinesToOpportunity } = await import(
      "@/lib/av-erp/change-orders"
    );
    const applied = await applyChangeOrderLinesToOpportunity(
      co.id,
      co.opportunity_id,
    );
    if (!applied.ok) return { ok: false, error: applied.error };

    if (sigRow?.id) {
      const { emailSignedChangeOrderCopy } = await import(
        "@/lib/av-erp/signed-document-email"
      );
      void emailSignedChangeOrderCopy({
        changeOrderId: co.id,
        token,
        signatureId: sigRow.id,
      });
    }
  }

  revalidatePath(`/change-order/${token}`);
  revalidatePath(`/rentals/quotes/${co.opportunity_id}`);
  revalidatePath("/rentals/quotes");
  return { ok: true, response: v.response };
}
