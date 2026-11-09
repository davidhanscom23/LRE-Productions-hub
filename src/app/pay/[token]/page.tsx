import { groupBySection } from "@/lib/project-invoices/sections";
import { notFound } from "next/navigation";
import { PayClient } from "@/components/project-invoices/pay-client";
import { COMPANY } from "@/lib/company";
import { loadPublicProjectInvoice } from "@/lib/project-invoices/server";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; canceled?: string }>;
};

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${d}T00:00:00Z`))
    : "";

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const inv = await loadPublicProjectInvoice(token);
  return { title: inv ? `Invoice ${inv.number} — ${COMPANY.displayName}` : `Invoice — ${COMPANY.displayName}`, robots: { index: false } };
}

export default async function ProjectInvoicePayPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { paid, canceled } = await searchParams;
  const inv = await loadPublicProjectInvoice(token);
  if (!inv) notFound();

  const settled = inv.status === "paid";
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-between gap-4 px-4 py-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em]">{COMPANY.displayName}</p>
            <p className="text-xs text-[var(--muted)]">{COMPANY.email} · {COMPANY.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">Invoice {inv.number}</p>
            {inv.issuedAt ? <p className="text-xs text-[var(--muted)]">Issued {day(inv.issuedAt)}</p> : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {paid ? (
          <p className="rounded-xl border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm">
            Thank you! Your payment went through. A receipt is on its way from Stripe, and this page updates within a minute.
          </p>
        ) : null}
        {canceled ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
            Checkout was canceled. No payment was taken.
          </p>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <p className="text-sm text-[var(--muted)]">
            {inv.clientName ? `Billed to ${inv.clientName}` : "Billed to"}
            {inv.projectName ? ` · ${inv.projectName}` : ""}
          </p>
          {inv.title ? <h1 className="mt-1 text-xl font-semibold">{inv.title}</h1> : null}
          {inv.status === "void" ? <p className="mt-2 text-sm font-medium text-red-600">This invoice has been voided.</p> : null}

          <div className="mt-4 space-y-4">
            {groupBySection(inv.lines).map((g) => (
              <section key={g.name}>
                <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-1">
                  <h2 className="text-sm font-semibold">{g.name}</h2>
                  <span className="text-sm font-semibold">{money(g.total)}</span>
                </div>
                <ul className="mt-1 text-sm">
                  {g.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3 border-b border-[var(--border)]/60 py-1.5">
                      <span>{l.description}</span>
                      <span className="text-[var(--muted)]">Qty {l.qty}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <dl className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(inv.subtotal)}</dd></div>
            {inv.taxAmount > 0 ? (
              <div className="flex justify-between"><dt>Tax ({inv.taxRatePct}%)</dt><dd>{money(inv.taxAmount)}</dd></div>
            ) : null}
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(inv.total)}</dd></div>
            {inv.amountPaid > 0 ? (
              <div className="flex justify-between"><dt>Paid</dt><dd>−{money(inv.amountPaid)}</dd></div>
            ) : null}
            <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-semibold">
              <dt>Balance due</dt><dd>{money(inv.outstanding)}</dd>
            </div>
          </dl>
        </section>

        {inv.installments.length > 1 ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Payment schedule</h2>
            <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
              {inv.installments.map((p, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{p.label}{p.due_at ? ` · due ${day(p.due_at)}` : ""}</span>
                  <span className={p.remaining === 0 ? "text-green-700" : p.overdue ? "font-medium text-red-600" : ""}>
                    {money(p.amount)} {p.remaining === 0 ? "· Paid" : p.overdue ? "· Overdue" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {inv.notes ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm whitespace-pre-wrap sm:p-5">{inv.notes}</section>
        ) : null}

        {settled ? (
          <p className="rounded-xl border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm font-medium">This invoice is paid in full. Thank you!</p>
        ) : inv.payable && inv.payEnabled ? (
          <PayClient token={token} label={inv.payable.label} amount={inv.payable.amount} />
        ) : inv.payable ? (
          <p className="text-sm text-[var(--muted)]">To pay this invoice, please contact us at {COMPANY.email} or {COMPANY.phone}.</p>
        ) : null}
      </div>
    </main>
  );
}
