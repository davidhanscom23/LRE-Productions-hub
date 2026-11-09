import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChangeOrderResponseClient } from "@/components/av-erp/change-order-response-client";
import { loadChangeOrderByToken } from "@/lib/av-erp/change-orders";
import { ESTIMATE_TOKEN_RE } from "@/lib/av-erp/public-estimate";
import { COMPANY } from "@/lib/company";
import { createServiceClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: `Change order | ${COMPANY.displayName}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default async function PublicChangeOrderPage({ params }: Props) {
  const { token } = await params;
  if (!ESTIMATE_TOKEN_RE.test(token)) notFound();
  const co = await loadChangeOrderByToken(token);
  if (!co) notFound();

  const existingStatus =
    co.status === "accepted" || co.status === "declined" ? co.status : null;

  const supabase = createServiceClient();
  const { data: lines } = await supabase
    .from("av_change_order_lines")
    .select(
      "id, description, qty, unit_price, apply_mode, sort_order",
    )
    .eq("change_order_id", co.id)
    .order("sort_order");

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-between gap-4 px-4 py-6">
          <div className="flex items-start gap-3">
            <Image
              src="/logo.png"
              alt={COMPANY.displayName}
              width={120}
              height={28}
              className="mt-0.5 h-7 w-auto"
              priority
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Change order
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                {co.number}
                {co.subject ? ` — ${co.subject}` : ""}
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Estimate {co.opportunity_reference}
                {co.opportunity_subject
                  ? ` · ${co.opportunity_subject}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-[var(--muted)]">
            {co.customer_name ? <p>{co.customer_name}</p> : null}
            <p className="font-semibold text-[var(--foreground)]">
              {co.amount_delta === 0
                ? "No amount change"
                : co.amount_delta > 0
                  ? `+${money(co.amount_delta)}`
                  : money(co.amount_delta)}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {co.summary.trim() ? (
          <section>
            <h2 className="text-sm font-semibold">Summary</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {co.summary}
            </p>
          </section>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Please review and accept or decline this change order.
          </p>
        )}

        {(lines ?? []).length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold">Line items</h2>
            <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {(lines ?? []).map((l) => (
                <li
                  key={l.id as string}
                  className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span>
                    <span className="text-[var(--muted)]">
                      [{String(l.apply_mode)}]{" "}
                    </span>
                    {String(l.description)}
                  </span>
                  <span className="text-[var(--muted)]">
                    {Number(l.qty)} × {money(Number(l.unit_price) || 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ChangeOrderResponseClient
          token={token}
          existingStatus={existingStatus}
          existingNote={co.response_note}
          existingSignerName={co.signer_name}
          defaultName={co.customer_name ?? ""}
        />

        <p className="mt-12 text-center text-xs text-[var(--muted)]">
          {COMPANY.displayName} · {COMPANY.phone} · {COMPANY.email}
        </p>
      </div>
    </main>
  );
}
