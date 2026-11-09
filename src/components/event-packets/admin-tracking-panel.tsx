"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PacketStatusBadge } from "@/components/event-packets/packet-status-badge";
import { formatPacketEventType } from "@/lib/event-packets/format-event-type";
import { packetMatchesQuery } from "@/lib/event-packets/match-packets";
import { isPacketOverdue } from "@/lib/event-packets/overdue";
import {
  PACKET_STATUS_LABELS,
  type EventPacket,
  type PacketStatus,
} from "@/lib/types/event-packets";

type AdminTrackingPanelProps = {
  packets: EventPacket[];
};

type ListFilter = "all" | "overdue" | "follow_up";

function isOverdue(packet: EventPacket): boolean {
  return isPacketOverdue(packet);
}

export function AdminTrackingPanel({ packets }: AdminTrackingPanelProps) {
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;
  const byStatus = PACKET_STATUS_LABELS;
  const counts = (Object.keys(byStatus) as PacketStatus[]).map((status) => ({
    status,
    count: packets.filter((packet) => packet.status === status).length,
  }));
  const overdue = packets.filter(isOverdue).length;
  const followUp = packets.filter((packet) => packet.follow_up_needed).length;

  const byStaff = new Map<
    string,
    {
      name: string;
      total: number;
      completed: number;
      open: number;
      overdue: number;
      followUp: number;
    }
  >();

  for (const packet of packets) {
    const key = packet.assignee_id;
    const name =
      packet.assignee?.full_name || packet.assignee?.email || packet.dj_name || "Staff";
    const entry = byStaff.get(key) ?? {
      name,
      total: 0,
      completed: 0,
      open: 0,
      overdue: 0,
      followUp: 0,
    };
    entry.total += 1;
    if (packet.status === "completed") entry.completed += 1;
    else entry.open += 1;
    if (isOverdue(packet)) entry.overdue += 1;
    if (packet.follow_up_needed) entry.followUp += 1;
    byStaff.set(key, entry);
  }

  const staffRows = Array.from(byStaff.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const filteredPackets = useMemo(() => {
    let list = [...packets];
    if (listFilter === "overdue") list = list.filter(isOverdue);
    if (listFilter === "follow_up") {
      list = list.filter((packet) => packet.follow_up_needed);
    }
    list = list.filter((packet) => packetMatchesQuery(packet, trimmedQuery));
    return list.sort((a, b) => {
      const aFollow = a.follow_up_needed ? 0 : 1;
      const bFollow = b.follow_up_needed ? 0 : 1;
      if (aFollow !== bFollow) return aFollow - bFollow;
      const aOverdue = isOverdue(a) ? 0 : 1;
      const bOverdue = isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return b.event_date.localeCompare(a.event_date);
    });
  }, [packets, listFilter, trimmedQuery]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Completion tracking
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Progress for calendar-assigned event packets across the team,
          including overdue wrap-ups and flagged follow-ups.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {counts.map((item) => (
          <div
            key={item.status}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <p className="text-xs text-[var(--muted)]">
              {PACKET_STATUS_LABELS[item.status]}
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
              {item.count}
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-xs text-red-800 dark:text-red-200">Overdue</p>
          <p className="mt-1 text-2xl font-semibold text-red-900 dark:text-red-100">
            {overdue}
          </p>
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Follow-up
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-950 dark:text-amber-100">
            {followUp}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Open</th>
              <th className="px-4 py-2 font-medium">Completed</th>
              <th className="px-4 py-2 font-medium">Overdue</th>
              <th className="px-4 py-2 font-medium">Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {staffRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-[var(--muted)]">
                  No packets yet. Sync from the calendar to create them.
                </td>
              </tr>
            ) : (
              staffRows.map((row) => (
                <tr key={row.name}>
                  <td className="px-4 py-2 font-medium text-[var(--foreground)]">
                    {row.name}
                  </td>
                  <td className="px-4 py-2">{row.total}</td>
                  <td className="px-4 py-2">{row.open}</td>
                  <td className="px-4 py-2">{row.completed}</td>
                  <td className="px-4 py-2">{row.overdue}</td>
                  <td className="px-4 py-2">{row.followUp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all", label: "All packets" },
            { id: "overdue", label: `Overdue (${overdue})` },
            { id: "follow_up", label: `Needs follow-up (${followUp})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setListFilter(item.id)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              listFilter === item.id
                ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {packets.length > 0 ? (
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by client, venue, staff, date, or event type…"
            aria-label="Search tracking packets"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />
        </label>
      ) : null}

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {filteredPackets.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
            {searching
              ? `No packets match “${trimmedQuery}”.`
              : listFilter === "follow_up"
                ? "No packets currently need follow-up."
                : listFilter === "overdue"
                  ? "No overdue packets right now."
                  : "No packets yet."}
          </p>
        ) : (
          filteredPackets.map((packet) => (
            <Link
              key={packet.id}
              href={`/event-packets/${packet.id}`}
              className={[
                "flex flex-col gap-2 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between",
                packet.follow_up_needed
                  ? "bg-amber-50/60 dark:bg-amber-950/20"
                  : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--foreground)]">
                  {packet.client_name || "Untitled client"} ·{" "}
                  {packet.venue?.name || packet.venue_raw || "Venue"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {packet.event_date} ·{" "}
                  {packet.assignee?.full_name || packet.dj_name} ·{" "}
                  {formatPacketEventType(packet)}
                  {isOverdue(packet) ? " · Overdue" : ""}
                </p>
                {packet.follow_up_needed && packet.follow_up_notes ? (
                  <p className="mt-1 line-clamp-2 text-xs text-amber-900/90 dark:text-amber-100/90">
                    {packet.follow_up_notes}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {packet.follow_up_needed ? (
                  <span className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                    Follow-up
                  </span>
                ) : null}
                {isOverdue(packet) ? (
                  <span className="inline-flex rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100">
                    Overdue
                  </span>
                ) : null}
                <PacketStatusBadge status={packet.status} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
