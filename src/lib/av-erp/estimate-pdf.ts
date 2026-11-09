import { rmsDocumentFromEstimate } from "@/lib/av-erp/documents/from-estimate";
import {
  buildRmsDocumentPdf,
  rmsDocumentFileName,
} from "@/lib/av-erp/documents/rms-document-pdf";
import type { CustomerEstimate } from "@/lib/av-erp/estimate-view";

/** Customer-facing estimate PDF (Current RMS layout; no venue markup disclosure). */
export async function buildEstimatePdf(
  estimate: CustomerEstimate,
): Promise<Uint8Array> {
  return buildRmsDocumentPdf(rmsDocumentFromEstimate(estimate, "estimate"));
}

/** Confirmed-order / quotation Contract PDF (same body + signature block). */
export async function buildContractPdf(
  estimate: CustomerEstimate,
): Promise<Uint8Array> {
  return buildRmsDocumentPdf(rmsDocumentFromEstimate(estimate, "contract"));
}

export function estimateFileName(estimate: CustomerEstimate): string {
  return rmsDocumentFileName(rmsDocumentFromEstimate(estimate, "estimate"));
}

export function contractFileName(estimate: CustomerEstimate): string {
  return rmsDocumentFileName(rmsDocumentFromEstimate(estimate, "contract"));
}
