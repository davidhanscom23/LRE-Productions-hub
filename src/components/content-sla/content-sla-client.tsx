"use client";

import Link from "next/link";
import {
  formatDraftStatus,
  type ContentSlaRow,
} from "@/lib/types/content-sla";
import { PACKET_STATUS_LABELS } from "@/lib/types/event-packets";

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function hoursLabel(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem ? `${days}d ${rem}h` : `${days}d`;
}

export function ContentSlaClient({ rows }: { rows: ContentSlaRow[] }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Content SLA
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Packets from the last ~21 days — media, consent, and marketing draft
          status for post-event content follow-through.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          No packets in this window.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
              <tr>
                <th className="px-3 py-2.5">Event</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Hours since</th>
                <th className="px-3 py-2.5">Media</th>
                <th className="px-3 py-2.5">Consent</th>
                <th className="px-3 py-2.5">Packet</th>
                <th className="px-3 py-2.5">Marketing drafts</th>
                <th className="px-3 py-2.5">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)]/70 last:border-0"
                >
                  <td className="px-3 py-2.5 align-top">
                    <p className="font-medium text-[var(--foreground)]">
                      {row.client_name}
                    </p>
                    {row.venue_raw ? (
                      <p className="text-xs text-[var(--muted)]">
                        {row.venue_raw}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap text-[var(--foreground)]">
                    {fmtDate(row.event_date)}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap text-[var(--foreground)]">
                    {hoursLabel(row.hoursSinceEvent)}
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--foreground)]">
                    {row.mediaCount > 0 ? (
                      <span>{row.mediaCount}</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">
                        None
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {row.social_consent ? (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Yes
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--muted)]">
                    {PACKET_STATUS_LABELS[row.status] ?? row.status}
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--foreground)]">
                    {formatDraftStatus(row.drafts)}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap">
                    <Link
                      href={`/event-packets/${row.id}`}
                      className="text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      Packet
                    </Link>
                    <span className="text-[var(--muted)]"> · </span>
                    <Link
                      href={`/marketing`}
                      className="text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      Queue
                    </Link>
                    <span className="text-[var(--muted)]"> · </span>
                    <Link
                      href={`/social-studio/${row.id}`}
                      className="text-xs font-medium text-[var(--brand)] hover:underline"
                    >
                      Studio
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
