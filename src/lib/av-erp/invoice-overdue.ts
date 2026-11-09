import { invoiceOutstanding } from "@/lib/av-erp/invoicing";

/** Eastern calendar date YYYY-MM-DD. */
export function easternTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isInvoiceOverdue(input: {
  status: string;
  dueAt: string | null | undefined;
  total: number;
  amountPaid: number;
  amountCredited?: number;
  todayYmd?: string;
}): boolean {
  if (input.status === "void" || input.status === "paid" || input.status === "draft") {
    return false;
  }
  const outstanding = invoiceOutstanding(
    Number(input.total) || 0,
    Number(input.amountPaid) || 0,
    Number(input.amountCredited) || 0,
  );
  if (!(outstanding > 0.001)) return false;
  const due = String(input.dueAt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  const today = input.todayYmd ?? easternTodayYmd();
  return due < today;
}

/** Skip cron email if reminded within this many hours. */
export const INVOICE_REMIND_DEDUPE_HOURS = 20;

export function shouldSendInvoiceReminder(input: {
  lastRemindedAt: string | null | undefined;
  now?: Date;
  dedupeHours?: number;
}): boolean {
  const last = input.lastRemindedAt;
  if (!last) return true;
  const ts = Date.parse(last);
  if (Number.isNaN(ts)) return true;
  const hours = input.dedupeHours ?? INVOICE_REMIND_DEDUPE_HOURS;
  const now = input.now ?? new Date();
  return now.getTime() - ts >= hours * 60 * 60 * 1000;
}
