import "server-only";

import { buildQbInvoice, buildQbPayment, customerDisplayName, qbEscape } from "./mapping";
import { qb, qbQuery } from "./client";
import { createServiceClient } from "@/lib/supabase/admin";

const ITEM_NAME = "Event services";

async function findOrCreateCustomer(name: string, email: string): Promise<string> {
  const found = await qbQuery<{ Id: string }>(`select Id from Customer where DisplayName = '${qbEscape(name)}'`, "Customer");
  if (found[0]) return found[0].Id;
  const created = await qb<{ Customer: { Id: string } }>("POST", "/customer", {
    DisplayName: name,
    ...(email.includes("@") ? { PrimaryEmailAddr: { Address: email } } : {}),
  });
  return created.Customer.Id;
}

async function findOrCreateItem(): Promise<string> {
  const found = await qbQuery<{ Id: string }>(`select Id from Item where Name = '${qbEscape(ITEM_NAME)}'`, "Item");
  if (found[0]) return found[0].Id;
  const acct = await qbQuery<{ Id: string }>("select Id from Account where AccountType = 'Income' maxresults 1", "Account");
  if (!acct[0]) throw new Error("QuickBooks has no Income account to attach the service item to.");
  const created = await qb<{ Item: { Id: string } }>("POST", "/item", {
    Name: ITEM_NAME,
    Type: "Service",
    IncomeAccountRef: { value: acct[0].Id },
  });
  return created.Item.Id;
}

export type SyncOutcome = { invoiceId: string; number: string; ok: boolean; message: string };

/** Push one Hub invoice (and any unsynced payments) to QuickBooks. Safe to re-run. */
export async function syncProjectInvoice(invoiceId: string): Promise<SyncOutcome> {
  const db = createServiceClient();
  const { data: inv } = await db.from("project_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return { invoiceId, number: "?", ok: false, message: "Invoice not found." };
  const number = String(inv.number);
  const fail = async (message: string): Promise<SyncOutcome> => {
    await db.from("project_invoices").update({ qb_sync_error: message.slice(0, 500) }).eq("id", invoiceId);
    return { invoiceId, number, ok: false, message };
  };
  if (inv.status === "draft" || inv.status === "void") return { invoiceId, number, ok: false, message: "Only sent invoices are synced." };

  try {
    const { data: project } = await db.from("pipeline_projects").select("name, client_id").eq("id", inv.project_id).maybeSingle();
    let clientName: string | null = null;
    let clientEmail = "";
    if (project?.client_id) {
      const { data: c } = await db.from("pipeline_clients").select("full_name, email").eq("id", project.client_id).maybeSingle();
      clientName = (c?.full_name as string | null) ?? null;
      clientEmail = String(c?.email ?? "");
    }
    const customerId = await findOrCreateCustomer(customerDisplayName(clientName, String(project?.name ?? "")), clientEmail);

    let qbInvoiceId = (inv.qb_invoice_id as string | null) ?? null;
    if (!qbInvoiceId) {
      // Guard against a half-finished earlier attempt: reuse an invoice with this number.
      const existing = await qbQuery<{ Id: string }>(`select Id from Invoice where DocNumber = '${qbEscape(number)}'`, "Invoice");
      if (existing[0]) {
        qbInvoiceId = existing[0].Id;
      } else {
        const { data: lines } = await db.from("project_invoice_lines").select("description, qty, unit_price").eq("invoice_id", invoiceId).order("sort_order");
        const itemId = await findOrCreateItem();
        const body = buildQbInvoice(
          {
            number,
            title: String(inv.title ?? ""),
            issuedAt: (inv.issued_at as string | null) ?? null,
            dueAt: (inv.due_at as string | null) ?? null,
            taxAmount: Number(inv.tax_amount),
            notes: String(inv.notes ?? ""),
            lines: (lines ?? []).map((l) => ({ description: String(l.description), qty: Number(l.qty), unit_price: Number(l.unit_price) })),
          },
          { customerId, itemId },
        );
        const created = await qb<{ Invoice: { Id: string } }>("POST", "/invoice", body);
        qbInvoiceId = created.Invoice.Id;
      }
      await db.from("project_invoices").update({ qb_invoice_id: qbInvoiceId }).eq("id", invoiceId);
    }

    const { data: pays } = await db
      .from("project_invoice_payments")
      .select("id, amount, received_at, reference, method")
      .eq("invoice_id", invoiceId)
      .is("qb_payment_id", null)
      .order("received_at");
    let paymentsSent = 0;
    for (const p of pays ?? []) {
      const created = await qb<{ Payment: { Id: string } }>(
        "POST",
        "/payment",
        buildQbPayment(
          { amount: Number(p.amount), receivedAt: String(p.received_at), reference: (p.reference as string | null) ?? null, method: String(p.method) },
          { customerId, qbInvoiceId },
        ),
      );
      await db.from("project_invoice_payments").update({ qb_payment_id: created.Payment.Id }).eq("id", p.id);
      paymentsSent += 1;
    }

    await db.from("project_invoices").update({ qb_synced_at: new Date().toISOString(), qb_sync_error: null }).eq("id", invoiceId);
    return { invoiceId, number, ok: true, message: paymentsSent ? `Synced with ${paymentsSent} payment${paymentsSent === 1 ? "" : "s"}.` : "Synced." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Sync failed.");
  }
}

/** Invoices that still need pushing: never synced, or with payments QuickBooks hasn't seen. */
export async function invoicesNeedingSync(limit = 25): Promise<{ id: string; number: string; reason: string }[]> {
  const db = createServiceClient();
  const { data: invs } = await db
    .from("project_invoices")
    .select("id, number, qb_invoice_id, project_invoice_payments(qb_payment_id)")
    .in("status", ["sent", "partial", "paid"])
    .order("created_at", { ascending: true })
    .limit(500);
  const out: { id: string; number: string; reason: string }[] = [];
  for (const i of invs ?? []) {
    const pays = (i.project_invoice_payments ?? []) as { qb_payment_id: string | null }[];
    if (!i.qb_invoice_id) out.push({ id: i.id as string, number: String(i.number), reason: "Not in QuickBooks yet" });
    else if (pays.some((p) => !p.qb_payment_id)) out.push({ id: i.id as string, number: String(i.number), reason: "New payment to send" });
    if (out.length >= limit) break;
  }
  return out;
}
