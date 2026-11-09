import { writeFileSync } from "node:fs";
import { buildCustomerEstimate } from "@/lib/av-erp/estimate-view";
import {
  buildContractPdf,
  buildEstimatePdf,
} from "@/lib/av-erp/estimate-pdf";
import { rmsDocumentFromInvoice } from "@/lib/av-erp/documents/from-invoice";
import { buildRmsDocumentPdf } from "@/lib/av-erp/documents/rms-document-pdf";

async function main() {
  const estimate = buildCustomerEstimate({
    reference: "Q-0042",
    subject: "Ballroom AV",
    customer: {
      name: "Acme Corp",
      contactName: "Pat Lee",
      email: "pat@acme.test",
      phone: "904-555-0100",
      addressLines: ["1 Main St", "Ponte Vedra, FL 32081"],
    },
    venue: {
      name: "Grand Hall",
      contactName: "Ops Desk",
      email: "",
      phone: "904-555-0199",
      addressLines: ["9 Venue Rd", "St Augustine, FL 32084"],
    },
    gearStartsAt: "2026-11-10T14:00:00.000Z",
    gearEndsAt: "2026-11-11T02:00:00.000Z",
    chargeStartsAt: "2026-11-10T18:00:00.000Z",
    chargeEndsAt: "2026-11-10T23:00:00.000Z",
    notes: "Load-in via loading dock B.",
    transportNotes: "Box truck.",
    terms: "A deposit confirms the reservation. Cancellation terms apply.",
    groups: [{ id: "g", name: "Main Portal", sort_order: 0 }],
    lines: [
      {
        id: "l1",
        group_id: "g",
        description: "Speaker array",
        qty: 2,
        unit_price: 150,
        discount_pct: 0,
        sort_order: 0,
        product_id: "p",
      },
      {
        id: "l2",
        group_id: "g",
        description: "A1 tech",
        qty: 1,
        unit_price: 600,
        discount_pct: 0,
        sort_order: 1,
        service_id: "s",
      },
    ],
    discountPct: 5,
  });

  const e = await buildEstimatePdf(estimate);
  const c = await buildContractPdf(estimate);
  const inv = await buildRmsDocumentPdf(
    rmsDocumentFromInvoice({
      invoice: {
        id: "inv",
        reference: "INV-1001",
        opportunity_id: null,
        customer_id: null,
        subject: "Ballroom AV",
        status: "sent",
        issued_at: "2026-11-01T12:00:00.000Z",
        due_at: "2026-11-15T12:00:00.000Z",
        subtotal: 855,
        total: 855,
        amount_paid: 200,
        amount_credited: 0,
        notes: "Net 15.",
        created_at: "",
        updated_at: "",
      },
      lines: [
        {
          id: "il",
          invoice_id: "inv",
          description: "Event package",
          qty: 1,
          unit_price: 855,
          sort_order: 0,
        },
      ],
      terms: "Payment due on receipt of this invoice.",
    }),
  );
  writeFileSync("/opt/cursor/artifacts/sample-estimate.pdf", e);
  writeFileSync("/opt/cursor/artifacts/sample-contract.pdf", c);
  writeFileSync("/opt/cursor/artifacts/sample-invoice.pdf", inv);
  console.log("wrote", e.byteLength, c.byteLength, inv.byteLength);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
