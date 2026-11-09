import type { CustomerEstimate } from "@/lib/av-erp/estimate-view";
import type { RmsDocument, RmsParty } from "@/lib/av-erp/documents/types";

function partyFromEstimate(
  p: CustomerEstimate["customer"],
  fallbackName: string | null,
): RmsParty | null {
  if (p) {
    return {
      name: p.name,
      contactName: p.contactName || undefined,
      email: p.email || undefined,
      phone: p.phone || undefined,
      lines: p.addressLines,
    };
  }
  if (fallbackName) return { name: fallbackName, lines: [] };
  return null;
}

/** Map a customer estimate into the shared Current-RMS document model. */
export function rmsDocumentFromEstimate(
  estimate: CustomerEstimate,
  kind: "estimate" | "contract" = "estimate",
): RmsDocument {
  return {
    kind,
    billingType: estimate.billingType ?? "direct",
    reference: estimate.reference,
    subject: estimate.subject,
    statusLabel: estimate.statusLabel,
    client: partyFromEstimate(estimate.customer, estimate.customerName),
    venue: partyFromEstimate(estimate.venue, estimate.venueName),
    gearStartsAt: estimate.gearStartsAt,
    gearEndsAt: estimate.gearEndsAt,
    chargeStartsAt: estimate.chargeStartsAt,
    chargeEndsAt: estimate.chargeEndsAt,
    sections: estimate.sections.map((s) => ({
      name: s.name,
      lines: s.lines.map((l) => ({
        id: l.id,
        typeLabel: l.typeLabel,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        discountAmount:
          Math.round(Math.max(0, l.qty * l.unitPrice - l.lineTotal) * 100) / 100 || undefined,
      })),
    })),
    linesSubtotal: estimate.linesSubtotal,
    surchargeAmount: estimate.surchargeAmount,
    discountAmount: estimate.discountAmount,
    taxAmount: Number(estimate.taxAmount) || 0,
    total: estimate.total,
    amountPaid: 0,
    amountCredited: 0,
    notes: estimate.notes,
    transportNotes: estimate.transportNotes,
    terms: estimate.terms ?? "",
    showSignature: true,
  };
}
