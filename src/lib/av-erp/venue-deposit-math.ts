import { invoiceOutstanding, roundMoney } from "@/lib/av-erp/invoicing";

/** Stable payment reference so re-drafting the same deposit stays idempotent. */
export function venueDepositPaymentReference(requestId: string): string {
  return `venue-deposit:${requestId}`;
}

export function venueDepositApplyAmount(input: {
  depositAmount: number;
  invoiceTotal: number;
  amountPaid: number;
  amountCredited: number;
}): number {
  const deposit = roundMoney(Math.max(0, Number(input.depositAmount) || 0));
  if (!(deposit > 0)) return 0;
  const outstanding = invoiceOutstanding(
    Number(input.invoiceTotal) || 0,
    Number(input.amountPaid) || 0,
    Number(input.amountCredited) || 0,
  );
  if (!(outstanding > 0)) return 0;
  return roundMoney(Math.min(deposit, outstanding));
}
