"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProposalFromQuoteAction } from "@/app/(app)/proposals/actions";
import {
  proposalStatusLabel,
  type Proposal,
  type ProposalStatus,
} from "@/lib/types/proposals";
import { formatQuoteMoney, type Quote } from "@/lib/types/quoting";

type Props = {
  isAdmin: boolean;
  driveConfigured: boolean;
  proposals: Proposal[];
  readyQuotes: Pick<
    Quote,
    | "id"
    | "client_name"
    | "event_name"
    | "event_date"
    | "department"
    | "status"
    | "updated_at"
    | "created_by"
  >[];
};

const STATUS_STYLES: Record<ProposalStatus, string> = {
  draft: "bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200",
  generated:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  uploaded:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  linked:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const day = iso.includes("T") ? iso.slice(0, 10) : iso;
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProposalsListClient({
  isAdmin,
  driveConfigured,
  proposals,
  readyQuotes,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function createFromQuote(quoteId: string) {
    setError(null);
    startTransition(async () => {
      const result = await createProposalFromQuoteAction(quoteId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.id) router.push(`/proposals/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Proposals
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Turn a Ready quote into a branded PDF, upload it to Google Drive, and
          (admins) attach the Drive link on a Pipeline project in the Hub.
        </p>
        {!driveConfigured ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Drive credentials aren’t configured here — you can still download
            PDFs. Set the service account + root folder on{" "}
            <Link href="/drive" className="underline">
              Google Drive
            </Link>{" "}
            to upload.
          </p>
        ) : null}
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Create from a Ready quote
        </h2>
        {readyQuotes.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No Ready quotes yet. Finish pricing on{" "}
            <Link href="/quoting" className="text-[var(--brand)] hover:underline">
              Quoting
            </Link>{" "}
            and Mark ready first.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {readyQuotes.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-[var(--foreground)]">
                    {q.client_name || "Untitled"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {q.department}
                    {q.event_name ? ` · ${q.event_name}` : ""}
                    {q.event_date ? ` · ${fmtDate(q.event_date)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => createFromQuote(q.id)}
                  className="inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Create proposal
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Proposals
        </h2>
        {proposals.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No proposals yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/proposals/${p.id}`}
                    className="text-sm font-medium text-[var(--brand)] hover:underline"
                  >
                    {p.title || p.client_name || "Proposal"}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {formatQuoteMoney(p.quote_total)}
                    {p.event_name ? ` · ${p.event_name}` : ""}
                    {isAdmin && p.creator_name ? ` · ${p.creator_name}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}
                >
                  {proposalStatusLabel(p.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
