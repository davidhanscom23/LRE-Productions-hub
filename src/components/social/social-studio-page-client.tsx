"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone, Search } from "lucide-react";
import { SOCIAL_PLATFORMS } from "@/lib/social/platforms";

export type StudioPacketRow = {
  id: string;
  client_name: string;
  event_date: string;
  event_type: string;
  dj_name: string;
  venue_label: string;
  status: string;
  media_count: number;
  caption_count: number;
};

type SocialStudioPageClientProps = {
  packets: StudioPacketRow[];
  driveConfigured: boolean;
};

function packetMatchesQuery(packet: StudioPacketRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    packet.client_name,
    packet.venue_label,
    packet.dj_name,
    packet.event_type,
    packet.event_date,
  ]
    .join("\n")
    .toLowerCase()
    .includes(q);
}

export function SocialStudioPageClient({
  packets,
  driveConfigured,
}: SocialStudioPageClientProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;

  const visiblePackets = useMemo(
    () => packets.filter((packet) => packetMatchesQuery(packet, trimmedQuery)),
    [packets, trimmedQuery],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-[var(--brand)]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Social Studio
          </h1>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Turn completed Event Packets into SEO/local-optimized captions for
          Facebook, Instagram, LinkedIn, TikTok, X, and YouTube — plus cropped image
          exports for each platform.
          {!driveConfigured
            ? " Google Drive backup is not configured yet (admin env vars)."
            : " Google Drive backup is available from each packet."}
        </p>
      </div>

      {packets.length > 0 ? (
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by client, venue, team member, date, or event type…"
            aria-label="Search Social Studio packets"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />
        </label>
      ) : null}

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {packets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No completed Event Packets with enough detail yet. Finish a packet,
            then come back here.
          </p>
        ) : visiblePackets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {searching
              ? `No packets match “${trimmedQuery}”.`
              : "No packets to show."}
          </p>
        ) : (
          visiblePackets.map((packet) => (
            <Link
              key={packet.id}
              href={`/social-studio/${packet.id}`}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  {packet.client_name || "Untitled client"}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {packet.event_date} · {packet.venue_label} · {packet.dj_name} ·{" "}
                  {packet.event_type}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {packet.media_count} media · {packet.caption_count}/
                {SOCIAL_PLATFORMS.length} captions
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
