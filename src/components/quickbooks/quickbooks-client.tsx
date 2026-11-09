"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectQuickBooks, syncAllInvoices, syncOneInvoice } from "@/app/(app)/quickbooks/actions";

type Props = {
  configured: boolean;
  production: boolean;
  connection: { realmId: string; companyName: string; connectedAt: string; refreshExpiresAt: string } | null;
  pending: { id: string; number: string; reason: string }[];
};

export function QuickBooksClient({ configured, production, connection, pending }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const run = (fn: () => Promise<string>) =>
    start(async () => {
      setNotice(await fn());
      router.refresh();
    });

  if (!configured) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <p className="font-medium">Not set up yet</p>
        <p className="mt-1 text-[var(--muted)]">
          Create an app at developer.intuit.com, add the redirect address <code>/api/quickbooks/callback</code> on this site, then add{" "}
          <code>QUICKBOOKS_CLIENT_ID</code> and <code>QUICKBOOKS_CLIENT_SECRET</code> in Vercel (and <code>QUICKBOOKS_ENVIRONMENT=production</code> when ready for real books).
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <p className="font-medium">
          {connection ? `Connected${connection.companyName ? `: ${connection.companyName}` : ""}` : "Not connected"}
          <span className="ml-2 rounded-full bg-[var(--border)] px-2 py-0.5 text-xs">{production ? "Live books" : "Test (sandbox)"}</span>
        </p>
        {connection ? (
          <>
            <p className="mt-1 text-[var(--muted)]">
              Connected {new Date(connection.connectedAt).toLocaleDateString()}. The link renews itself whenever it is used.
            </p>
            <button
              disabled={busy}
              onClick={() => {
                if (confirm("Disconnect QuickBooks? Invoices already sent stay in QuickBooks.")) {
                  run(async () => ((await disconnectQuickBooks()).error ?? "Disconnected."));
                }
              }}
              className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
            >
              Disconnect
            </button>
          </>
        ) : (
          <a href="/api/quickbooks/connect" className="mt-3 inline-block rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs text-[var(--background)]">
            Connect QuickBooks
          </a>
        )}
      </section>

      {connection && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Waiting to sync ({pending.length})</h2>
            {pending.length > 0 && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await syncAllInvoices();
                    if (!("results" in r)) return r.error;
                    const ok = r.results.filter((x) => x.ok).length;
                    return `Synced ${ok} of ${r.results.length}.`;
                  })
                }
                className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs text-[var(--background)]"
              >
                {busy ? "Working…" : "Sync all"}
              </button>
            )}
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 text-[var(--muted)]">Everything sent so far is in QuickBooks.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{p.number}</span>
                    <span className="ml-2 text-xs text-[var(--muted)]">{p.reason}</span>
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await syncOneInvoice(p.id);
                        return "error" in r && r.error ? r.error : (r as { message: string }).message;
                      })
                    }
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
                  >
                    Sync
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {notice && <p className="text-sm text-[var(--muted)]">{notice}</p>}
    </div>
  );
}
