import type { RmsDocument, RmsDocPayment } from "@/lib/av-erp/documents/types";
import { groupBySection } from "./sections";

export type ProjectInvoiceDocInput = {
  number: string;
  title: string;
  issuedAt: string | null;
  dueAt: string | null;
  taxRatePct: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  notes: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  lines: { description: string; qty: number; unit_price: number; section?: string }[];
  installments: { label: string; amount: number; due_at: string | null }[];
  payUrl: string | null;
  payments: { received_at: string; method: string; reference: string | null; amount: number }[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function paymentDetails(i: ProjectInvoiceDocInput): string {
  const parts: string[] = [];
  if (i.installments.length > 1) {
    parts.push(
      "Payment schedule: " +
        i.installments.map((p) => `${p.label} ${money(p.amount)}${p.due_at ? ` due ${p.due_at}` : ""}`).join("; ") +
        ".",
    );
  }
  if (i.payUrl) parts.push(`Pay online: ${i.payUrl}`);
  return parts.join("\n");
}

/** Customer invoice / receipt model for a HoneyBook project invoice. Items show quantity only; prices are per section. */
export function rmsDocumentFromProjectInvoice(input: ProjectInvoiceDocInput, kind: "invoice" | "receipt"): RmsDocument {
  const sections = groupBySection(input.lines).map((g) => ({
    name: g.name,
    lines: g.lines.map((l, i) => ({
      id: `${g.name}-${i}`,
      typeLabel: "Service",
      description: l.description,
      qty: l.qty,
      unitPrice: l.unit_price,
      lineTotal: r2(l.qty * l.unit_price),
    })),
  }));
  const payments: RmsDocPayment[] = [...input.payments]
    .sort((a, b) => a.received_at.localeCompare(b.received_at))
    .map((p) => ({ receivedAt: p.received_at, method: p.method, reference: p.reference ?? "", amount: Number(p.amount) || 0 }));
  const isReceipt = kind === "receipt";
  return {
    kind,
    reference: input.number,
    subject: input.title || input.projectName,
    issuedAt: isReceipt && payments.length ? payments[payments.length - 1].receivedAt : input.issuedAt,
    dueAt: isReceipt ? null : input.dueAt,
    client: input.clientName || input.clientEmail ? { name: input.clientName, email: input.clientEmail, lines: [] } : null,
    venue: null,
    gearStartsAt: null,
    gearEndsAt: null,
    chargeStartsAt: null,
    chargeEndsAt: null,
    sections,
    linesSubtotal: input.subtotal,
    surchargeAmount: 0,
    discountAmount: 0,
    taxAmount: input.taxAmount,
    total: input.total,
    amountPaid: isReceipt ? r2(payments.reduce((s, p) => s + p.amount, 0)) : input.amountPaid,
    amountCredited: 0,
    notes: input.notes,
    transportNotes: "",
    terms: "",
    paymentDetails: isReceipt ? "" : paymentDetails(input),
    payments: isReceipt ? payments : undefined,
    showSignature: false,
  };
}
