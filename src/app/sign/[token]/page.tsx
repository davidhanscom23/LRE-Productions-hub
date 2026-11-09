import { notFound } from "next/navigation";
import { ContractView } from "@/components/project-contracts/contract-view";
import { SignClient } from "@/components/project-contracts/sign-client";
import { COMPANY } from "@/lib/company";
import { loadPublicContract } from "@/lib/project-contracts/server";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const c = await loadPublicContract(token);
  return { title: c ? `${c.title} — ${COMPANY.displayName}` : `Agreement — ${COMPANY.displayName}`, robots: { index: false } };
}

export default async function SignContractPage({ params }: Props) {
  const { token } = await params;
  const c = await loadPublicContract(token);
  if (!c) notFound();

  return (
    <main
      className="min-h-screen bg-neutral-100 text-neutral-900"
      // The signing page is always a light "paper" page, whatever theme the visitor's browser prefers.
      style={{ "--background": "#f3f4f6", "--foreground": "#111827", "--surface": "#ffffff", "--surface-hover": "#f9fafb", "--border": "#e5e7eb", "--muted": "#737373", "--brand": "#9a7340", "--brand-soft": "#f3e9d8" } as React.CSSProperties}
    >
      <header className="border-b-[3px] border-[#c9a05c] bg-[#0e0e0e]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={COMPANY.displayName} className="h-9 w-auto sm:h-11" />
          <p className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9a05c] sm:text-xs">{COMPANY.tagline}</p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
        {c.projectName ? <p className="mt-1 text-sm text-neutral-500">{c.projectName}</p> : null}
        <div className="mt-3 h-[3px] w-12 bg-[#c9a05c]" />

        <article className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <ContractView body={c.body} />
        </article>

        {c.status === "sent" ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
            <SignClient token={token} defaultName={c.clientName} defaultEmail={c.clientEmail} />
          </div>
        ) : c.status === "signed" ? (
          <p className="mt-6 rounded-xl border border-green-600/30 bg-green-50 px-4 py-3 text-sm font-medium text-green-900">
            Signed by {c.signerName}
            {c.signedAt
              ? ` on ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "long" }).format(new Date(c.signedAt))}`
              : ""}
            . Thank you!
          </p>
        ) : c.status === "declined" ? (
          <p className="mt-6 text-sm text-neutral-600">This agreement was declined.</p>
        ) : (
          <p className="mt-6 text-sm text-neutral-600">
            This agreement is no longer active. Please contact us at {COMPANY.email}.
          </p>
        )}
        <p className="mt-8 text-center text-xs text-neutral-500">
          {COMPANY.address} · {COMPANY.phone} · {COMPANY.email}
        </p>
      </div>
    </main>
  );
}
