import "server-only";

import {
  emailInvoicePayLink,
  loadInvoiceCustomerEmail,
} from "@/lib/av-erp/invoice-pay-email";
import {
  easternTodayYmd,
  isInvoiceOverdue,
  shouldSendInvoiceReminder,
} from "@/lib/av-erp/invoice-overdue";
import { invoiceOutstanding } from "@/lib/av-erp/invoicing";
import { newInvoicePayToken } from "@/lib/av-erp/public-invoice";
import { insertNotifications } from "@/lib/notifications/notify";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export type RemindOverdueInvoicesResult = {
  ran: boolean;
  examined: number;
  emailed: number;
  notified: number;
  skipped: number;
  error: string | null;
};

/**
 * Email overdue unpaid customers a pay-link nudge (Resend) and ping AV staff.
 * Dedupes with last_reminded_at (~20h).
 */
export async function runOverdueInvoiceReminders(): Promise<RemindOverdueInvoicesResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ran: false,
      examined: 0,
      emailed: 0,
      notified: 0,
      skipped: 0,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required for overdue invoice reminders.",
    };
  }

  const supabase = createServiceClient();
  const today = easternTodayYmd();
  const { data: invoices, error } = await supabase
    .from("av_invoices")
    .select(
      "id, reference, subject, status, due_at, total, amount_paid, amount_credited, pay_token, pay_enabled, last_reminded_at, remind_count, customer_id, created_by",
    )
    .not("status", "in", '("draft","void","paid")')
    .lt("due_at", today)
    .order("due_at", { ascending: true })
    .limit(200);

  if (error) {
    if (/last_reminded_at|remind_count|column/i.test(error.message)) {
      return {
        ran: false,
        examined: 0,
        emailed: 0,
        notified: 0,
        skipped: 0,
        error:
          "Invoice reminders need migration 157_venue_catalog_invoice_reminders.sql in Supabase.",
      };
    }
    return {
      ran: false,
      examined: 0,
      emailed: 0,
      notified: 0,
      skipped: 0,
      error: error.message,
    };
  }

  const overdue = (invoices ?? []).filter((inv) =>
    isInvoiceOverdue({
      status: String(inv.status),
      dueAt: inv.due_at as string | null,
      total: Number(inv.total) || 0,
      amountPaid: Number(inv.amount_paid) || 0,
      amountCredited: Number(inv.amount_credited) || 0,
      todayYmd: today,
    }),
  );

  let emailed = 0;
  let skipped = 0;
  const staffNotes: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    href: string;
  }[] = [];

  for (const inv of overdue) {
    if (
      !shouldSendInvoiceReminder({
        lastRemindedAt: inv.last_reminded_at as string | null,
      })
    ) {
      skipped += 1;
      continue;
    }

    const outstanding = invoiceOutstanding(
      Number(inv.total) || 0,
      Number(inv.amount_paid) || 0,
      Number(inv.amount_credited) || 0,
    );
    if (!(outstanding > 0.001)) {
      skipped += 1;
      continue;
    }

    let token = String(inv.pay_token ?? "").trim();
    if (!token) token = newInvoicePayToken();
    await supabase
      .from("av_invoices")
      .update({ pay_token: token, pay_enabled: true })
      .eq("id", inv.id);

    const customer = await loadInvoiceCustomerEmail(supabase, String(inv.id));
    if (!customer) {
      skipped += 1;
      continue;
    }

    const path = `/invoice/${token}`;
    const sent = await emailInvoicePayLink({
      to: customer.email,
      customerName: customer.customerName,
      reference: customer.reference || String(inv.reference),
      subject: customer.subject || String(inv.subject ?? ""),
      path,
    });

    if (!sent.ok && !sent.skipped) {
      skipped += 1;
      continue;
    }
    if (sent.skipped) {
      skipped += 1;
      continue;
    }

    emailed += 1;
    await supabase
      .from("av_invoices")
      .update({
        last_reminded_at: new Date().toISOString(),
        remind_count: (Number(inv.remind_count) || 0) + 1,
      })
      .eq("id", inv.id);

    if (inv.created_by) {
      staffNotes.push({
        userId: inv.created_by as string,
        kind: "invoice_overdue",
        title: "Overdue invoice reminder sent",
        body: `${inv.reference} · ${customer.email} · due ${String(inv.due_at).slice(0, 10)}`,
        href: `/rentals/invoices/${inv.id}`,
      });
    }
  }

  if (staffNotes.length) {
    await insertNotifications(supabase, staffNotes);
  }

  return {
    ran: true,
    examined: overdue.length,
    emailed,
    notified: staffNotes.length,
    skipped,
    error: null,
  };
}
