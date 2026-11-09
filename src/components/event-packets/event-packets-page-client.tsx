"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import {
  syncEventPacketsAction,
  syncSheetReviewsAction,
} from "@/app/(app)/event-packets/actions";
import { AdminTrackingPanel } from "@/components/event-packets/admin-tracking-panel";
import { LaunchPastPacketPanel } from "@/components/event-packets/launch-past-packet-panel";
import { MediaLibraryPanel } from "@/components/event-packets/media-library-panel";
import { PacketStatusBadge } from "@/components/event-packets/packet-status-badge";
import { VenuesAdminPanel } from "@/components/event-packets/venues-admin-panel";
import { packetMatchesQuery } from "@/lib/event-packets/match-packets";
import { formatPacketEventType } from "@/lib/event-packets/format-event-type";
import { isPacketOverdue } from "@/lib/event-packets/overdue";
import type {
  EventPacket,
  PacketStatus,
  VenueWithAliases,
} from "@/lib/types/event-packets";

type TabId = "mine" | "library" | "tracking" | "venues";

type LibraryItem = {
  id: string;
  file_name: string;
  folder_path: string;
  location_name: string;
  event_date: string;
  dj_name: string;
  client_name: string;
};

type EventPacketsPageClientProps = {
  myPackets: EventPacket[];
  allPackets: EventPacket[];
  venues: VenueWithAliases[];
  libraryItems: LibraryItem[];
  isAdmin: boolean;
};

function PacketList({
  packets,
  emptyLabel,
}: {
  packets: EventPacket[];
  emptyLabel?: string;
}) {
  if (packets.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        {emptyLabel ??
          "No event packets here yet. Sync from the calendar after events run, or ask an admin to sync the company feed."}
      </div>
    );
  }

  const order: PacketStatus[] = [
    "needs_completion",
    "in_progress",
    "completed",
  ];
  const sorted = [...packets].sort((a, b) => {
    const aOptional = a.completion_optional ? 1 : 0;
    const bOptional = b.completion_optional ? 1 : 0;
    if (aOptional !== bOptional) return aOptional - bOptional;
    const aOverdue = isPacketOverdue(a) ? 0 : 1;
    const bOverdue = isPacketOverdue(b) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const aFollow = a.follow_up_needed ? 0 : 1;
    const bFollow = b.follow_up_needed ? 0 : 1;
    if (aFollow !== bFollow) return aFollow - bFollow;
    const statusDiff = order.indexOf(a.status) - order.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    return b.event_date.localeCompare(a.event_date);
  });

  return (
    <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {sorted.map((packet) => {
        const overdue = isPacketOverdue(packet);
        return (
          <Link
            key={packet.id}
            href={`/event-packets/${packet.id}`}
            className={[
              "flex flex-col gap-2 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between",
              overdue || packet.follow_up_needed
                ? "bg-amber-50/70 dark:bg-amber-950/20"
                : "",
            ].join(" ")}
          >
            <div>
              <p className="font-medium text-[var(--foreground)]">
                {packet.client_name || "Untitled client"}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {packet.event_date} · {packet.venue?.name || packet.venue_raw} ·{" "}
                {formatPacketEventType(packet)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {overdue ? (
                <span className="inline-flex rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100">
                  Overdue
                </span>
              ) : null}
              {packet.completion_optional ? (
                <span className="inline-flex rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs font-medium text-[var(--muted)]">
                  Optional archive
                </span>
              ) : null}
              {packet.follow_up_needed ? (
                <span className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                  Follow-up
                </span>
              ) : null}
              <PacketStatusBadge status={packet.status} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function EventPacketsPageClient({
  myPackets,
  allPackets,
  venues,
  libraryItems,
  isAdmin,
}: EventPacketsPageClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("mine");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;

  const openCount = myPackets.filter(
    (packet) =>
      packet.status !== "completed" && !packet.completion_optional,
  ).length;
  const overdueMine = myPackets.filter((packet) => isPacketOverdue(packet));
  const followUpMine = myPackets.filter(
    (packet) => packet.follow_up_needed && !packet.completion_optional,
  );

  const visibleMine = useMemo(
    () =>
      myPackets.filter((packet) => packetMatchesQuery(packet, trimmedQuery)),
    [myPackets, trimmedQuery],
  );

  function handleSync() {
    setSyncError(null);
    setSyncMessage(null);
    startTransition(async () => {
      const result = await syncEventPacketsAction();
      if (result.error) {
        setSyncError(result.error);
        return;
      }
      const unmatched =
        result.unmatchedStaff && result.unmatchedStaff.length
          ? ` Unmatched staff text: ${result.unmatchedStaff.slice(0, 5).join("; ")}`
          : "";
      setSyncMessage(
        `Sync complete — created ${result.created ?? 0}, updated ${result.updated ?? 0}.${unmatched}`,
      );
      router.refresh();
    });
  }

  function handleReviewsSync() {
    setSyncError(null);
    setSyncMessage(null);
    startTransition(async () => {
      const result = await syncSheetReviewsAction();
      if (result.error) {
        setSyncError(result.error);
        return;
      }
      const withId = result.withEventId ?? 0;
      const created = result.packetsCreated ?? 0;
      const fromReviews = result.packetsFromReviewsOnly ?? 0;
      const onCal = result.reviewIdsOnCalendar ?? 0;
      const feeds = result.calendarFeedsScanned ?? 0;
      const calEvents = result.calendarEventsLoaded ?? 0;
      const calIds = result.calendarEventIdsFound ?? 0;
      const noStaff = result.skippedNoStaff ?? 0;
      setSyncMessage(
        `Website reviews synced — ${result.upserted ?? 0} rows (${withId} with Event ID${
          result.source ? ` via ${result.source}` : ""
        }), ${result.matched ?? 0} matched to packets${
          created
            ? `, created ${created} packets (${fromReviews} from review data when not on calendar)`
            : ""
        }. Calendar scan: ${feeds} feeds / ${calEvents} events / ${calIds} Event IDs; ${onCal} review IDs on calendars.${
          noStaff ? ` ${noStaff} skipped (no matching Hub staff name).` : ""
        } ${result.unmatched ?? 0} still waiting (older than 24 months, or missing Event ID / staff match).`,
      );
      router.refresh();
    });
  }

  const tabs: { id: TabId; label: string; adminOnly?: boolean }[] = [
    { id: "mine", label: `My packets${openCount ? ` (${openCount})` : ""}` },
    { id: "library", label: "Library" },
    { id: "tracking", label: "Tracking", adminOnly: true },
    { id: "venues", label: "Venues", adminOnly: true },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Event Packets
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Calendar-assigned end-of-event forms with photos — complete these so
            nothing falls through the cracks. Generic report/photo tools remain
            under Field tools.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            <RefreshCw
              className={["h-4 w-4", pending ? "animate-spin" : ""].join(" ")}
            />
            {pending ? "Syncing…" : "Sync from calendar"}
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={handleReviewsSync}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              Sync website reviews
            </button>
          ) : null}
        </div>
      </div>

      {syncError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {syncError}
        </p>
      ) : null}
      {syncMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {syncMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {tabs
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                tab === item.id
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
      </div>

      {tab === "mine" ? (
        <div className="space-y-3">
          <LaunchPastPacketPanel />
          {overdueMine.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-medium">
                {overdueMine.length === 1
                  ? "1 packet is overdue"
                  : `${overdueMine.length} packets are overdue`}
              </p>
              <p className="mt-0.5 text-amber-900/80 dark:text-amber-100/80">
                Incomplete packets are overdue the day after the event. Finish
                them so media and wrap-up stay on track.
              </p>
            </div>
          ) : null}
          {followUpMine.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-medium">
                {followUpMine.length === 1
                  ? "1 packet needs follow-up by admin"
                  : `${followUpMine.length} packets need follow-up by admin`}
              </p>
              <p className="mt-0.5 text-amber-900/80 dark:text-amber-100/80">
                You flagged these for admin follow-up. Admins see them on the
                Tracking tab.
              </p>
            </div>
          ) : null}
          {myPackets.length > 0 ? (
            <label className="relative block max-w-xl">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by client, venue, team member, date, or event type…"
                aria-label="Search my event packets"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>
          ) : null}
          <PacketList
            packets={visibleMine}
            emptyLabel={
              searching
                ? `No packets match “${trimmedQuery}”.`
                : undefined
            }
          />
        </div>
      ) : null}
      {tab === "library" ? (
        <MediaLibraryPanel items={libraryItems} isAdmin={isAdmin} />
      ) : null}
      {tab === "tracking" && isAdmin ? (
        <AdminTrackingPanel packets={allPackets} />
      ) : null}
      {tab === "venues" && isAdmin ? (
        <VenuesAdminPanel venues={venues} />
      ) : null}
    </div>
  );
}
