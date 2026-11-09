/** Shared customer-facing document model (Current RMS–style layout). */

export type RmsDocumentKind = "estimate" | "contract" | "invoice" | "receipt";

export type RmsParty = {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  lines: string[];
};

export type RmsDocLine = {
  id: string;
  /** Rental / Sale / Service — matches Current RMS Type column. */
  typeLabel: string;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  /** Discount taken on this line, shown only as part of the section total. */
  discountAmount?: number;
  note?: string;
};

/** A payment shown on a receipt. */
export type RmsDocPayment = {
  receivedAt: string;
  method: string;
  reference: string;
  amount: number;
};

export type RmsDocSection = {
  name: string;
  lines: RmsDocLine[];
};

export type RmsDocument = {
  kind: RmsDocumentKind;
  /** e.g. Q-0009 / INV-0012 */
  reference: string;
  subject: string;
  statusLabel?: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  client: RmsParty | null;
  venue: RmsParty | null;
  gearStartsAt: string | null;
  gearEndsAt: string | null;
  chargeStartsAt: string | null;
  chargeEndsAt: string | null;
  sections: RmsDocSection[];
  linesSubtotal: number;
  surchargeAmount: number;
  discountAmount: number;
  /** Always shown for RMS parity; Hub invoices currently pass 0. */
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountCredited: number;
  notes: string;
  transportNotes: string;
  terms: string;
  /** venue = the venue pays Vident; shows the master-bill note, no surcharge row. */
  billingType?: "direct" | "venue";
  /** Estimates: last day the prices are held. */
  validUntil?: string | null;
  /** Invoices: how to pay (shown under "Payment Details"). */
  paymentDetails?: string;
  /** Receipts: the payments received. */
  payments?: RmsDocPayment[];
  /** Signature block on estimate + contract. */
  showSignature: boolean;
  /** When set, draws the customer e-sign PNG onto the signature block. */
  signatureStamp?: {
    signerName: string;
    signedAt: string;
    imageDataUrl: string;
  } | null;
};

export function rmsDocTitle(kind: RmsDocumentKind): string {
  switch (kind) {
    case "estimate":
      return "Estimate";
    case "receipt":
      return "Receipt";
    case "contract":
      return "Contract";
    case "invoice":
      return "Invoice";
  }
}

export function rmsBalanceDue(doc: RmsDocument): number {
  return Math.max(
    0,
    Math.round(
      (doc.total - doc.amountPaid - doc.amountCredited + Number.EPSILON) * 100,
    ) / 100,
  );
}

export function formatPartyAddress(input: {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): string[] {
  const lines: string[] = [];
  const a1 = (input.address_line1 ?? "").trim();
  const a2 = (input.address_line2 ?? "").trim();
  if (a1) lines.push(a1);
  if (a2) lines.push(a2);
  const city = (input.city ?? "").trim();
  const region = (input.region ?? "").trim();
  const postal = (input.postal_code ?? "").trim();
  const cityLine = [city, [region, postal].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  const country = (input.country ?? "").trim();
  if (country && country.toUpperCase() !== "US" && country.toUpperCase() !== "USA") {
    lines.push(country);
  }
  return lines;
}
