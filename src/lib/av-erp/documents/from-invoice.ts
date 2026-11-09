import { formatPartyAddress, type RmsDocPayment, type RmsDocument, type RmsParty } from "@/lib/av-erp/documents/types";
import type {
  AvCustomer,
  AvInvoice,
  AvInvoiceLine,
  AvJobVenue,
  AvPayment,
} from "@/lib/av-erp/types";

function partyFromCustomer(c: AvCustomer | null | undefined): RmsParty | null {
  if (!c) return null;
  return {
    name: c.name,
    contactName: c.contact_name || undefined,
    email: c.email || undefined,
    phone: c.phone || undefined,
    lines: formatPartyAddress(c),
  };
}

function partyFromVenue(v: AvJobVenue | null | undefined): RmsParty | null {
  if (!v) return null;
  return {
    name: v.name,
    contactName: v.contact_name || undefined,
    email: v.email || undefined,
    phone: v.phone || undefined,
    lines: formatPartyAddress(v),
  };
}

const SURCHARGE_RE = /^surcharge\b/i;
const DISCOUNT_RE = /^discount\b/i;

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type InvoiceDocInput = {
  invoice: AvInvoice;
  lines: AvInvoiceLine[];
  customer?: AvCustomer | null;
  venue?: AvJobVenue | null;
  terms?: string;
  gearStartsAt?: string | null;
  gearEndsAt?: string | null;
  chargeStartsAt?: string | null;
  chargeEndsAt?: string | null;
  billingType?: "direct" | "venue";
  paymentDetails?: string;
};

/**
 * Map a Hub invoice into the shared document model. The Surcharge and Discount lines the
 * invoice stores as ordinary lines are pulled out so they show in the totals, like the estimate.
 */
export function rmsDocumentFromInvoice(input: InvoiceDocInput): RmsDocument {
  const { invoice, lines } = input;
  const sorted = [...lines].sort(
    (a, b) => a.sort_order - b.sort_order || a.description.localeCompare(b.description),
  );
  const amount = (l: AvInvoiceLine) => r2(Math.max(0, Number(l.qty) || 0) * (Number(l.unit_price) || 0));

  let surcharge = 0;
  let discount = 0;
  const items = sorted.filter((l) => {
    if (SURCHARGE_RE.test(l.description.trim())) {
      surcharge += amount(l);
      return false;
    }
    if (DISCOUNT_RE.test(l.description.trim()) && Number(l.unit_price) < 0) {
      discount += Math.abs(amount(l));
      return false;
    }
    return true;
  });
  const linesSubtotal = r2(items.reduce((s, l) => s + amount(l), 0));

  return {
    kind: "invoice",
    billingType: input.billingType ?? "direct",
    reference: invoice.reference,
    subject: invoice.subject,
    statusLabel: invoice.status,
    issuedAt: invoice.issued_at,
    dueAt: invoice.due_at,
    client: partyFromCustomer(input.customer),
    venue: partyFromVenue(input.venue),
    gearStartsAt: input.gearStartsAt ?? null,
    gearEndsAt: input.gearEndsAt ?? null,
    chargeStartsAt: input.chargeStartsAt ?? null,
    chargeEndsAt: input.chargeEndsAt ?? null,
    sections: [
      {
        name: "Items",
        lines: items.map((l) => ({
          id: l.id,
          typeLabel: "Item",
          description: l.description,
          qty: Number(l.qty) || 0,
          unitPrice: Number(l.unit_price) || 0,
          lineTotal: amount(l),
        })),
      },
    ],
    linesSubtotal: surcharge > 0 || discount > 0 ? linesSubtotal : Number(invoice.subtotal) || linesSubtotal,
    surchargeAmount: r2(surcharge),
    discountAmount: r2(discount),
    taxAmount: Number(invoice.tax_amount) || 0,
    total: Number(invoice.total) || 0,
    amountPaid: Number(invoice.amount_paid) || 0,
    amountCredited: Number(invoice.amount_credited) || 0,
    notes: invoice.notes ?? "",
    transportNotes: "",
    terms: input.terms ?? "",
    paymentDetails: input.paymentDetails,
    showSignature: false,
  };
}

/** A receipt for an invoice: the same items and totals, plus the payments received. */
export function rmsReceiptFromInvoice(input: InvoiceDocInput & { payments: AvPayment[] }): RmsDocument {
  const base = rmsDocumentFromInvoice(input);
  const payments: RmsDocPayment[] = [...input.payments]
    .sort((a, b) => a.received_at.localeCompare(b.received_at))
    .map((p) => ({
      receivedAt: p.received_at,
      method: p.method,
      reference: p.reference,
      amount: Number(p.amount) || 0,
    }));
  const latest = payments.length ? payments[payments.length - 1].receivedAt : base.issuedAt;
  return {
    ...base,
    kind: "receipt",
    issuedAt: latest ?? null,
    amountPaid: r2(payments.reduce((s, p) => s + p.amount, 0)),
    payments,
    terms: "",
  };
}
