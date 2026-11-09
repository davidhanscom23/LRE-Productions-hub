import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EstimatePublicClient } from "@/components/av-erp/estimate-public-client";
import { EstimateResponseClient } from "@/components/av-erp/estimate-response-client";
import { VENUE_BILLING_NOTE } from "@/lib/av-erp/billing-type";
import { COMPANY } from "@/lib/company";
import {
  ESTIMATE_TOKEN_RE,
  loadCustomerEstimateByToken,
} from "@/lib/av-erp/public-estimate";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: `Event Estimate | ${COMPANY.displayName}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PartyBlock({
  label,
  party,
  fallbackName,
}: {
  label: string;
  party: {
    name: string;
    contactName: string;
    email: string;
    phone: string;
    addressLines: string[];
  } | null;
  fallbackName: string | null;
}) {
  const name = party?.name || fallbackName;
  if (!name) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{name}</p>
      {party?.contactName ? (
        <p className="text-sm">{party.contactName}</p>
      ) : null}
      {party?.addressLines.map((line) => (
        <p key={line} className="text-sm text-[var(--muted)]">
          {line}
        </p>
      ))}
      {party?.phone ? (
        <p className="text-sm text-[var(--muted)]">Phone: {party.phone}</p>
      ) : null}
      {party?.email ? (
        <p className="text-sm text-[var(--muted)]">{party.email}</p>
      ) : null}
    </div>
  );
}

export default async function PublicEstimatePage({ params }: Props) {
  const { token } = await params;
  if (!ESTIMATE_TOKEN_RE.test(token)) notFound();
  const estimate = await loadCustomerEstimateByToken(token);
  if (!estimate) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-4 px-4 py-6">
          <div className="flex items-start gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em]">
                {COMPANY.displayName}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {COMPANY.tagline}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {COMPANY.address}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {COMPANY.phone} · {COMPANY.email}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-wide">EVENT ESTIMATE</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Estimate Number</p>
            <p className="font-semibold">{estimate.reference}</p>
            <div className="mt-3">
              <EstimatePublicClient token={token} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-semibold">
          {estimate.subject || "Untitled"}
        </h1>
        {estimate.statusLabel ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Status: {estimate.statusLabel}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PartyBlock
            label="Client"
            party={estimate.customer}
            fallbackName={estimate.customerName}
          />
          <PartyBlock
            label="Venue / Site"
            party={estimate.venue}
            fallbackName={estimate.venueName}
          />
        </div>

        <div className="mt-6 rounded-lg bg-[var(--surface)] px-3 py-3 text-xs text-[var(--muted)] sm:text-sm">
          <span>
            Ship / Out: {fmtWhen(estimate.gearStartsAt)}
          </span>
          <span className="mx-2">·</span>
          <span>
            Return / In: {fmtWhen(estimate.gearEndsAt)}
          </span>
          {estimate.chargeStartsAt || estimate.chargeEndsAt ? (
            <>
              <span className="mx-2">·</span>
              <span>
                Show: {fmtWhen(estimate.chargeStartsAt)} →{" "}
                {fmtWhen(estimate.chargeEndsAt)}
              </span>
            </>
          ) : null}
        </div>

        <div className="mt-8 space-y-6">
          {estimate.sections.map((section) => (
            <section key={section.name}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{section.name}</h2>
                <span className="text-sm font-semibold">
                  {money(
                    section.lines.reduce((sum, l) => sum + l.lineTotal, 0),
                  )}
                </span>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[20rem] border-y border-[var(--border)] text-sm">
                  <thead>
                    <tr className="bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-2 py-2 font-semibold">Type</th>
                      <th className="px-2 py-2 font-semibold">Qty</th>
                      <th className="px-2 py-2 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {section.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-2 py-2 text-[var(--muted)]">
                          {line.typeLabel}
                        </td>
                        <td className="px-2 py-2">{line.qty}</td>
                        <td className="px-2 py-2">{line.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <aside className="mt-8 ml-auto max-w-xs space-y-1 border-t border-[var(--border)] pt-4 text-sm">
          <div className="flex justify-between text-[var(--muted)]">
            <span>Subtotal</span>
            <span>{money(estimate.linesSubtotal)}</span>
          </div>
          {estimate.surchargeAmount > 0 ? (
            <div className="flex justify-between text-[var(--muted)]">
              <span>Surcharge</span>
              <span>{money(estimate.surchargeAmount)}</span>
            </div>
          ) : null}
          {estimate.discountAmount > 0 ? (
            <div className="flex justify-between text-[var(--muted)]">
              <span>Discount</span>
              <span>−{money(estimate.discountAmount)}</span>
            </div>
          ) : null}
          {estimate.taxAmount > 0 || estimate.taxRatePct > 0 ? (
            <div className="flex justify-between text-[var(--muted)]">
              <span>
                Sales Tax
                {estimate.taxRatePct > 0
                  ? ` (${estimate.taxRatePct}%)`
                  : ""}
              </span>
              <span>{money(estimate.taxAmount)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-[var(--muted)]">
              <span>Sales Tax</span>
              <span>{money(0)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{money(estimate.total)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Balance Due</span>
            <span>{money(estimate.total)}</span>
          </div>
        </aside>

        {estimate.billingType === "venue" ? (
          <p className="mt-4 border-l-4 border-[var(--brand)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold">
            {VENUE_BILLING_NOTE}
          </p>
        ) : null}

        {estimate.notes.trim() ? (
          <section className="mt-8">
            <h3 className="text-sm font-semibold">Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {estimate.notes}
            </p>
          </section>
        ) : null}
        {estimate.transportNotes.trim() ? (
          <section className="mt-6">
            <h3 className="text-sm font-semibold">Transport / delivery</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {estimate.transportNotes}
            </p>
          </section>
        ) : null}

        {estimate.terms?.trim() ? (
          <section className="mt-8">
            <h3 className="text-sm font-semibold">Terms &amp; Conditions</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {estimate.terms}
            </p>
          </section>
        ) : null}

        <EstimateResponseClient
          token={token}
          defaultName={estimate.contactName ?? ""}
          defaultEmail={estimate.contactEmail ?? ""}
          estimateResponse={estimate.estimateResponse ?? null}
          estimateNote={estimate.estimateResponseNote ?? ""}
          estimateSignerName={estimate.estimateSignerName ?? ""}
          contractResponse={estimate.contractResponse ?? null}
          contractNote={estimate.contractResponseNote ?? ""}
          contractSignerName={estimate.contractSignerName ?? ""}
          allowContractSign
        />

        <p className="mt-12 text-center text-xs text-[var(--muted)]">
          {COMPANY.displayName} · {COMPANY.phone} · {COMPANY.email}
        </p>
      </div>
    </main>
  );
}
