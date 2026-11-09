"use client";

export type HandbookRosterRow = {
  userId: string;
  name: string;
  email: string;
  signedAt: string | null;
};

type HandbookAckRosterProps = {
  revision: string;
  isDraft: boolean;
  rows: HandbookRosterRow[];
};

export function HandbookAckRoster({
  revision,
  isDraft,
  rows,
}: HandbookAckRosterProps) {
  const signed = rows.filter((row) => row.signedAt);
  const unsigned = rows.filter((row) => !row.signedAt);

  return (
    <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 print:hidden sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Acknowledgement roster
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Active staff vs signatures for the current handbook revision (
          {isDraft ? "draft" : "live"}
          {revision ? ` · ${revision}` : ""}).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Active staff", value: rows.length },
          { label: "Signed", value: signed.length },
          { label: "Not signed", value: unsigned.length },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3"
          >
            <p className="text-xs text-[var(--muted)]">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Signed at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-[var(--muted)]">
                  No active staff profiles found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-[var(--foreground)]">
                      {row.name}
                    </p>
                    {row.email ? (
                      <p className="text-xs text-[var(--muted)]">{row.email}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    {row.signedAt ? (
                      <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
                        Signed
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                        Not signed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[var(--muted)]">
                    {row.signedAt
                      ? new Date(row.signedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
