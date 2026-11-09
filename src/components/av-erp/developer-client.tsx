"use client";

import { useActionState } from "react";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  createAvApiKeyAction,
  revokeAvApiKeyAction,
  type DeveloperActionState,
} from "@/app/(app)/rentals/developer/actions";
import type { AvIntegrationTokenRow } from "@/lib/av-erp/terminal-token-types";

type Props = {
  tokens: AvIntegrationTokenRow[];
  loadError: string | null;
};

const initial: DeveloperActionState = { ok: false };

export function DeveloperClient({ tokens, loadError }: Props) {
  const [createState, createAction, createPending] = useActionState(
    createAvApiKeyAction,
    initial,
  );
  const revealed =
    createState.ok && createState.plaintext ? createState.plaintext : null;

  const active = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <h1 className="text-xl font-semibold">Developer and API</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Keys for Claude, a script, or another system to read or write this shop —
        KM called this Terminal Mode. Give one key per place it is used so you
        can revoke a single connection.
      </p>

      {loadError ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Developer keys need a database update</p>
          <p className="mt-1">
            Run{" "}
            <code>supabase/migrations/148_av_integration_tokens.sql</code> in
            Supabase → SQL Editor, then refresh. ({loadError})
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
        <p>
          <span className="font-semibold">A key is a password to the shop.</span>{" "}
          Whoever holds it can reach customers, jobs, and catalog without
          signing in. Write keys can also create or update records. Paste it
          only into tools you trust.
        </p>
      </div>

      {revealed ? (
        <div
          data-testid="av-developer-new-key"
          className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
        >
          <p className="text-sm font-semibold">
            Copy this key now — it will not be shown again
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {createState.label ? `Created for “${createState.label}”.` : null}
          </p>
          <input
            readOnly
            value={revealed}
            aria-label="New API key"
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--brand)]/40"
            onClick={() => void navigator.clipboard?.writeText(revealed)}
          >
            Copy
          </button>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Active keys</h2>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No keys yet. Make one, then paste it into Terminal / Claude.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {active.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {t.token_prefix}… ·{" "}
                    {t.scopes.includes("write") ? "Read + write" : "Read only"}
                    {t.last_used_at
                      ? ` · Last used ${new Date(t.last_used_at).toLocaleDateString()}`
                      : " · Never used yet"}
                  </p>
                </div>
                <form action={revokeAvApiKeyAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:border-red-400 hover:text-red-700"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 border-t border-[var(--border)] pt-6">
        <h2 className="text-sm font-semibold">Make a key</h2>
        <form action={createAction} className="mt-3 max-w-md space-y-3">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Name</span>
            <input
              name="label"
              required
              maxLength={60}
              placeholder="David's terminal"
              data-testid="av-developer-key-label"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="write" className="rounded border" />
            Allow write (create/update customers; create/update draft estimates)
          </label>
          {createState.error ? (
            <p className="text-sm text-red-700 dark:text-red-300">
              {createState.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={createPending || Boolean(loadError)}
            data-testid="av-developer-create"
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {createPending ? "Creating…" : "Create key"}
          </button>
        </form>
        <div className="mt-4 space-y-1 text-xs text-[var(--muted)]">
          <p>
            Auth:{" "}
            <code className="text-[var(--foreground)]">
              Authorization: Bearer avk_live_…
            </code>
          </p>
          <p>
            Read:{" "}
            <code className="text-[var(--foreground)]">
              GET /api/av/terminal/v1/opportunities
            </code>
            ,{" "}
            <code className="text-[var(--foreground)]">/customers</code>,{" "}
            <code className="text-[var(--foreground)]">/catalog</code>
          </p>
          <p>
            Write (key must include write):{" "}
            <code className="text-[var(--foreground)]">
              POST/PATCH /customers
            </code>
            ,{" "}
            <code className="text-[var(--foreground)]">
              POST/PATCH /opportunities
            </code>
            ,{" "}
            <code className="text-[var(--foreground)]">
              DELETE /customers
            </code>{" "}
            (soft-retire). Catalog stays read-only. Estimate status via Terminal is
            limited to draft/quotation.
          </p>
        </div>
      </section>

      {revoked.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--muted)]">
            Revoked
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
            {revoked.map((t) => (
              <li key={t.id}>
                {t.label} · {t.token_prefix}…
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AvErpPage>
  );
}
