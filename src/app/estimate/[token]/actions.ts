"use server";

import { buildEstimatePdf, estimateFileName } from "@/lib/av-erp/estimate-pdf";
import {
  ESTIMATE_TOKEN_RE,
  loadCustomerEstimateByToken,
} from "@/lib/av-erp/public-estimate";
import { buildStampedOpportunityPdf } from "@/lib/av-erp/signed-document-email";
import { createServiceClient } from "@/lib/supabase/admin";

export type PublicPdfResult =
  | { ok: true; pdfBase64: string; fileName: string }
  | { ok: false; error: string };

export async function downloadPublicEstimatePdfAction(
  token: string,
): Promise<PublicPdfResult> {
  if (!ESTIMATE_TOKEN_RE.test(token)) {
    return { ok: false, error: "Invalid link." };
  }
  const estimate = await loadCustomerEstimateByToken(token);
  if (!estimate) return { ok: false, error: "Estimate not found." };

  const supabase = createServiceClient();
  const { data: opp } = await supabase
    .from("av_opportunities")
    .select("id")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();

  if (opp?.id) {
    const stamped = await buildStampedOpportunityPdf(opp.id, "estimate");
    if (stamped) {
      return {
        ok: true,
        pdfBase64: Buffer.from(stamped.bytes).toString("base64"),
        fileName: stamped.fileName,
      };
    }
  }

  const bytes = await buildEstimatePdf(estimate);
  return {
    ok: true,
    pdfBase64: Buffer.from(bytes).toString("base64"),
    fileName: estimateFileName(estimate),
  };
}
