import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoicePayClient } from "@/components/av-erp/invoice-pay-client";
import { loadPublicInvoiceByPayToken } from "@/lib/av-erp/public-invoice";
import { COMPANY } from "@/lib/company";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ canceled?: string }>;
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const invoice = await loadPublicInvoiceByPayToken(token);
  return {
    title: invoice
      ? `Invoice ${invoice.reference} — ${COMPANY.displayName}`
      : `Invoice — ${COMPANY.displayName}`,
  };
}

export default async function PublicInvoicePayPage({
  params,
  searchParams,
}: Props) {
  const { token } = await params;
  const { canceled } = await searchParams;
  const invoice = await loadPublicInvoiceByPayToken(token);
  if (!invoice) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-between gap-4 px-4 py-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em]">
              {COMPANY.displayName}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {COMPANY.phone} · {COMPANY.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-wide">INVOICE</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Invoice Number</p>
            <p className="font-semibold">{invoice.reference}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold">{invoice.subject || "Invoice"}</h1>
        {invoice.customerName ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Bill to {invoice.customerName}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-y border-[var(--border)] text-sm">
            <thead>
              <tr className="bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="px-2 py-2 font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">Rate</th>
                <th className="px-2 py-2 text-right font-semibold">Ext</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {invoice.lines.map((line, i) => (
                <tr key={`${line.description}-${i}`}>
                  <td className="px-2 py-2">{line.description}</td>
                  <td className="px-2 py-2">{line.qty}</td>
                  <td className="px-2 py-2 text-right">
                    {money(line.unitPrice)}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">
                    {money(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-[var(--muted)]">
            <span>Total</span>
            <span>{money(invoice.total)}</span>
          </div>
          {invoice.amountPaid > 0 ? (
            <div className="flex justify-between text-[var(--muted)]">
              <span>Paid</span>
              <span>−{money(invoice.amountPaid)}</span>
            </div>
          ) : null}
          {invoice.amountCredited > 0 ? (
            <div className="flex justify-between text-[var(--muted)]">
              <span>Credits</span>
              <span>−{money(invoice.amountCredited)}</span>
            </div>
          ) : null}
          <div className="flex justify-between pt-2 text-base font-semibold">
            <span>Balance due</span>
            <span>{money(invoice.outstanding)}</span>
          </div>
        </aside>

        <InvoicePayClient
          token={token}
          outstanding={invoice.outstanding}
          canceled={canceled === "1"}
        />

        <p className="mt-10 text-center text-xs text-[var(--muted)]">
          <Link href="/" className="underline-offset-2 hover:underline">
            {COMPANY.displayName}
          </Link>
        </p>
      </div>
    </main>
  );
}
