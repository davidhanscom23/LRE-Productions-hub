"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  ImageIcon,
  Megaphone,
  Search,
  Send,
  ShieldCheck,
  ShieldX,
  Video,
} from "lucide-react";
import {
  approvePublishAction,
  denyPublishAction,
  markPostedAction,
  publishDraftAction,
  queuePacketForMarketingAction,
  requestPublishApprovalAction,
  setDraftPinterestBoardAction,
  setDraftTargetAccountAction,
  updateDraftCaptionAction,
  updateDraftCollaboratorsAction,
  updateDraftMediaAction,
  updateDraftScheduleAction,
  updateDraftStatusAction,
} from "@/app/(app)/marketing/actions";
import { isImageMediaItem, isVideoMediaItem } from "@/lib/media/file-kind";
import { resolveDisplayableImageUrl } from "@/lib/media/resolve-preview-url";
import {
  PLATFORM_MEDIA_RULES,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  platformMediaLimitLabel,
  type SocialPlatform,
} from "@/lib/social/platforms";
import type { PostForMeAccount } from "@/lib/social/postforme-types";
import { normalizeIgCollaborators } from "@/lib/social/ig-collaborators";
import {
  compatibleMediaForPlatform,
  validateDraftMediaSelection,
} from "@/lib/social/draft-media";
import type { PinterestBoard } from "@/lib/social/pinterest-boards-types";
import { PinterestBoardsAdmin } from "@/components/marketing/pinterest-boards-admin";

export type DraftStatus =
  | "draft"
  | "ready"
  | "pending_approval"
  | "posted"
  | "skipped"
  | "rejected";

export type MarketingPacketRow = {
  id: string;
  client_name: string;
  event_date: string;
  venue_label: string;
  dj_name: string;
  social_consent: boolean;
  caption_count: number;
  media_count: number;
  draft_count: number;
};

export type MarketingDraftRow = {
  id: string;
  packet_id: string;
  platform: SocialPlatform;
  caption: string;
  status: DraftStatus;
  notes: string;
  scheduled_for: string | null;
  media_id: string | null;
  /** Ordered multi-select attachments (falls back to [media_id]). */
  media_ids: string[];
  external_post_id: string | null;
  publish_error: string | null;
  rejection_reason: string | null;
  /** Instagram Collabs usernames (max 3). */
  ig_collaborators: string[];
  /** Post for Me connection id (spc_…) when set. */
  target_social_account_id: string | null;
  /** Pinterest board id for board_ids (null = account default only). */
  target_pinterest_board_id: string | null;
  client_name: string;
  event_date: string;
  venue_label: string;
};

export type MarketingMediaOption = {
  id: string;
  file_name: string;
  media_type: string;
  signed_url?: string | null;
};

type MarketingQueueClientProps = {
  packets: MarketingPacketRow[];
  drafts: MarketingDraftRow[];
  mediaByPacketId?: Record<string, MarketingMediaOption[]>;
  /** Platforms with API publish configured (Meta / LinkedIn / TikTok / …). */
  apiPlatforms?: SocialPlatform[];
  /** @deprecated Use apiPlatforms */
  metaPlatforms?: SocialPlatform[];
  /** Connected Post for Me brands/pages for the per-draft picker. */
  socialAccounts?: PostForMeAccount[];
  /** Admin-managed Pinterest boards for the per-draft Board picker. */
  pinterestBoards?: PinterestBoard[];
  /** Default board id when a Pinterest draft has none saved. */
  pinterestDefaultBoardId?: string | null;
  isAdmin?: boolean;
  initialFilter?: string | null;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isDue(draft: MarketingDraftRow, now = Date.now()): boolean {
  if (
    draft.status === "posted" ||
    draft.status === "skipped" ||
    draft.status === "pending_approval" ||
    draft.status === "rejected"
  ) {
    return false;
  }
  if (!draft.scheduled_for) return false;
  const ms = Date.parse(draft.scheduled_for);
  return Number.isFinite(ms) && ms <= now;
}

const FILTERS = [
  "all",
  "pending",
  "due",
  "ready",
  "draft",
  "posted",
  "rejected",
] as const;

type FilterKey = (typeof FILTERS)[number];

function normalizeFilter(value: string | null | undefined): FilterKey {
  if (value === "pending_approval") return "pending";
  if (FILTERS.includes(value as FilterKey)) return value as FilterKey;
  return "all";
}

function draftMatchesQuery(draft: MarketingDraftRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    draft.client_name,
    draft.venue_label,
    draft.caption,
    draft.notes,
    draft.event_date,
    draft.status,
    SOCIAL_PLATFORM_LABELS[draft.platform],
    draft.platform,
    draft.rejection_reason ?? "",
    draft.publish_error ?? "",
    ...(draft.ig_collaborators ?? []),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(q);
}

function packetMatchesQuery(packet: MarketingPacketRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    packet.client_name,
    packet.venue_label,
    packet.dj_name,
    packet.event_date,
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(q);
}

export function MarketingQueueClient({
  packets,
  drafts,
  mediaByPacketId = {},
  apiPlatforms,
  metaPlatforms = [],
  socialAccounts = [],
  pinterestBoards = [],
  pinterestDefaultBoardId = null,
  isAdmin = false,
  initialFilter = null,
}: MarketingQueueClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>(() =>
    normalizeFilter(initialFilter),
  );
  const [filterBaseline, setFilterBaseline] = useState(initialFilter);
  const [captionByDraft, setCaptionByDraft] = useState<Record<string, string>>(
    {},
  );
  const [targetByDraft, setTargetByDraft] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const draft of drafts) {
        if (draft.target_social_account_id) {
          initial[draft.id] = draft.target_social_account_id;
        }
      }
      return initial;
    },
  );
  const [boardByDraft, setBoardByDraft] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const draft of drafts) {
        if (draft.target_pinterest_board_id) {
          initial[draft.id] = draft.target_pinterest_board_id;
        }
      }
      return initial;
    },
  );
  if (initialFilter !== filterBaseline) {
    setFilterBaseline(initialFilter);
    setFilter(normalizeFilter(initialFilter));
  }
  const publishPlatforms = apiPlatforms ?? metaPlatforms;
  const apiSet = useMemo(
    () => new Set(publishPlatforms),
    [publishPlatforms],
  );

  const accountsByProvider = useMemo(() => {
    const map = new Map<string, PostForMeAccount[]>();
    for (const account of socialAccounts) {
      const list = map.get(account.provider) ?? [];
      list.push(account);
      map.set(account.provider, list);
    }
    return map;
  }, [socialAccounts]);

  function accountsForDraft(draft: MarketingDraftRow): PostForMeAccount[] {
    return accountsByProvider.get(draft.platform) ?? [];
  }

  function selectedTargetFor(draft: MarketingDraftRow): string {
    const accounts = accountsForDraft(draft);
    const fromState = targetByDraft[draft.id];
    if (fromState) return fromState;
    if (draft.target_social_account_id) return draft.target_social_account_id;
    if (accounts.length === 1) return accounts[0]!.id;
    return "";
  }

  function setTargetAccount(draft: MarketingDraftRow, accountId: string) {
    const next = accountId.trim();
    setError(null);
    setMessage(null);
    setTargetByDraft((prev) => ({ ...prev, [draft.id]: next }));
    startTransition(async () => {
      const result = await setDraftTargetAccountAction(
        draft.id,
        next || null,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        next
          ? `Post as ${accountsForDraft(draft).find((a) => a.id === next)?.username ?? "selected brand"}.`
          : "Brand cleared — will use the platform default.",
      );
      router.refresh();
    });
  }

  function captionFor(draft: MarketingDraftRow): string {
    if (Object.prototype.hasOwnProperty.call(captionByDraft, draft.id)) {
      return captionByDraft[draft.id] ?? "";
    }
    return draft.caption ?? "";
  }

  function selectedBoardFor(draft: MarketingDraftRow): string {
    const fromState = boardByDraft[draft.id];
    if (fromState) return fromState;
    if (draft.target_pinterest_board_id) return draft.target_pinterest_board_id;
    return pinterestDefaultBoardId ?? "";
  }

  function setPinterestBoard(draft: MarketingDraftRow, boardId: string) {
    const next = boardId.trim();
    setError(null);
    setMessage(null);
    setBoardByDraft((prev) => ({ ...prev, [draft.id]: next }));
    startTransition(async () => {
      const result = await setDraftPinterestBoardAction(
        draft.id,
        next || null,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      const label =
        pinterestBoards.find((b) => b.board_id === next)?.label ?? next;
      setMessage(
        next
          ? `Pinterest board set to ${label}.`
          : "Board cleared — will use the account default board.",
      );
      router.refresh();
    });
  }

  const dueCount = useMemo(
    () => drafts.filter((draft) => isDue(draft)).length,
    [drafts],
  );
  const pendingCount = useMemo(
    () => drafts.filter((draft) => draft.status === "pending_approval").length,
    [drafts],
  );

  const visiblePackets = useMemo(
    () => packets.filter((packet) => packetMatchesQuery(packet, query)),
    [packets, query],
  );

  const visible = useMemo(() => {
    return drafts.filter((draft) => {
      if (!draftMatchesQuery(draft, query)) return false;
      if (filter === "due") return isDue(draft);
      if (filter === "pending") return draft.status === "pending_approval";
      if (filter === "all") return true;
      return draft.status === filter;
    });
  }, [drafts, filter, query]);

  const searching = query.trim().length > 0;

  const consentByPacketId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const packet of packets) {
      map.set(packet.id, Boolean(packet.social_consent));
    }
    return map;
  }, [packets]);

  const missingConsentCount = useMemo(
    () =>
      drafts.filter(
        (draft) =>
          draft.status !== "posted" &&
          draft.status !== "skipped" &&
          !consentByPacketId.get(draft.packet_id),
      ).length,
    [drafts, consentByPacketId],
  );

  function queuePacket(packetId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await queuePacketForMarketingAction(packetId, {
        scheduleInHours: 24,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      const created = result.created ?? 0;
      const updated = result.updated ?? 0;
      setMessage(
        created > 0
          ? `Queued ${created} platform draft(s), scheduled ~24h out${
              updated > 0 ? ` · filled ${updated} caption(s) from Social Studio` : ""
            }.`
          : updated > 0
            ? `Drafts already queued — filled ${updated} empty caption(s) from Social Studio.`
            : "All platforms were already in the Marketing Queue for this packet.",
      );
      router.refresh();
    });
  }

  function setStatus(draftId: string, status: DraftStatus) {
    startTransition(async () => {
      const result = await updateDraftStatusAction(draftId, status);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  async function copyCaption(draft: MarketingDraftRow) {
    if (!draft.caption) return;
    await navigator.clipboard.writeText(draft.caption);
    setCopiedId(draft.id);
    window.setTimeout(() => setCopiedId(null), 1200);
  }

  function saveCaption(draftId: string, caption: string) {
    startTransition(async () => {
      const result = await updateDraftCaptionAction(draftId, caption);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function saveMedia(draftId: string, mediaIds: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await updateDraftMediaAction(draftId, mediaIds);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function saveCollaborators(draftId: string, value: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateDraftCollaboratorsAction(draftId, value);
      if (result.error) setError(result.error);
      else {
        setMessage(
          result.usernames && result.usernames.length > 0
            ? `Saved IG collaborators: @${result.usernames.join(", @")}`
            : "Cleared IG collaborators.",
        );
        router.refresh();
      }
    });
  }

  function saveSchedule(draftId: string, localValue: string) {
    startTransition(async () => {
      const iso = localValue ? new Date(localValue).toISOString() : null;
      const result = await updateDraftScheduleAction(draftId, iso);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function submitPublish(draft: MarketingDraftRow) {
    const accounts = accountsForDraft(draft);
    const selected = selectedTargetFor(draft);
    if (accounts.length >= 2 && !selected) {
      setError(
        `Choose a brand for ${SOCIAL_PLATFORM_LABELS[draft.platform]} first.`,
      );
      return;
    }
    if (!captionFor(draft).trim()) {
      setError(
        `Add a caption before posting to ${SOCIAL_PLATFORM_LABELS[draft.platform]}.`,
      );
      return;
    }
    if (draft.platform === "pinterest") {
      const packetMedia = mediaByPacketId[draft.packet_id] ?? [];
      const ids =
        draft.media_ids?.length > 0
          ? draft.media_ids
          : draft.media_id
            ? [draft.media_id]
            : [];
      const hasImage = ids.some((id) => {
        const item = packetMedia.find((m) => m.id === id);
        return item ? isImageMediaItem(item) : false;
      });
      // Auto-picked first selectable image counts too when media_ids empty.
      const fallbackImage = compatibleMediaForPlatform(
        "pinterest",
        packetMedia,
      ).find((m) => isImageMediaItem(m));
      if (!hasImage && !fallbackImage) {
        setError("Pinterest requires at least one image on the draft.");
        return;
      }
    }

    setError(null);
    setMessage(null);
    setPublishingId(draft.id);
    startTransition(async () => {
      // Persist auto-selected single account (or picker value) so publish uses it.
      if (selected && selected !== (draft.target_social_account_id ?? "")) {
        const save = await setDraftTargetAccountAction(draft.id, selected);
        if (save.error) {
          setPublishingId(null);
          setError(save.error);
          return;
        }
      }
      if (draft.platform === "pinterest" && pinterestBoards.length > 0) {
        const board = selectedBoardFor(draft);
        if (board && board !== (draft.target_pinterest_board_id ?? "")) {
          const saveBoard = await setDraftPinterestBoardAction(draft.id, board);
          if (saveBoard.error) {
            setPublishingId(null);
            setError(saveBoard.error);
            return;
          }
        }
      }

      const result = await publishDraftAction(draft.id);
      setPublishingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.pendingApproval) {
        setMessage(
          `Approval requested for ${SOCIAL_PLATFORM_LABELS[draft.platform]}. Admins were notified.`,
        );
      } else {
        setMessage(
          `Posted to ${SOCIAL_PLATFORM_LABELS[draft.platform]}${
            result.externalPostId ? ` (${result.externalPostId})` : ""
          }.`,
        );
      }
      router.refresh();
    });
  }

  function markPosted(draft: MarketingDraftRow) {
    setError(null);
    setMessage(null);
    setPublishingId(draft.id);
    startTransition(async () => {
      const result = await markPostedAction(draft.id);
      setPublishingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        draft.platform === "youtube"
          ? "Marked YouTube as posted. Keep the Studio upload URL in notes if useful."
          : `Marked ${SOCIAL_PLATFORM_LABELS[draft.platform]} as posted.`,
      );
      router.refresh();
    });
  }

  function requestApproval(draft: MarketingDraftRow) {
    setError(null);
    setMessage(null);
    setPublishingId(draft.id);
    startTransition(async () => {
      const result = await requestPublishApprovalAction(draft.id);
      setPublishingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Approval requested for ${SOCIAL_PLATFORM_LABELS[draft.platform]}. Admins were notified.`,
      );
      router.refresh();
    });
  }

  function approve(draft: MarketingDraftRow) {
    const accounts = accountsForDraft(draft);
    const selected = selectedTargetFor(draft);
    if (accounts.length >= 2 && !selected) {
      setError(
        `Choose a brand for ${SOCIAL_PLATFORM_LABELS[draft.platform]} first.`,
      );
      return;
    }
    if (!captionFor(draft).trim()) {
      setError(
        `Add a caption before posting to ${SOCIAL_PLATFORM_LABELS[draft.platform]}.`,
      );
      return;
    }

    setError(null);
    setMessage(null);
    setPublishingId(draft.id);
    startTransition(async () => {
      if (selected && selected !== (draft.target_social_account_id ?? "")) {
        const save = await setDraftTargetAccountAction(draft.id, selected);
        if (save.error) {
          setPublishingId(null);
          setError(save.error);
          return;
        }
      }
      if (draft.platform === "pinterest" && pinterestBoards.length > 0) {
        const board = selectedBoardFor(draft);
        if (board && board !== (draft.target_pinterest_board_id ?? "")) {
          const saveBoard = await setDraftPinterestBoardAction(draft.id, board);
          if (saveBoard.error) {
            setPublishingId(null);
            setError(saveBoard.error);
            return;
          }
        }
      }

      const result = await approvePublishAction(draft.id);
      setPublishingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Approved ${SOCIAL_PLATFORM_LABELS[draft.platform]}${
          result.externalPostId ? ` (${result.externalPostId})` : ""
        }.`,
      );
      router.refresh();
    });
  }

  function deny(draft: MarketingDraftRow) {
    const reason =
      typeof window !== "undefined"
        ? window.prompt("Optional reason for denial:", "") ?? ""
        : "";
    setError(null);
    setMessage(null);
    setPublishingId(draft.id);
    startTransition(async () => {
      const result = await denyPublishAction(draft.id, reason);
      setPublishingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Denied ${SOCIAL_PLATFORM_LABELS[draft.platform]}.`);
      router.refresh();
    });
  }

  function downloadPostPack(packetId: string) {
    const rows = drafts.filter((draft) => draft.packet_id === packetId);
    if (!rows.length) {
      setError("Queue drafts for this packet first.");
      return;
    }
    const sample = rows[0]!;
    const body = [
      `${sample.client_name} — ${sample.venue_label} — ${sample.event_date}`,
      "",
      ...rows.map(
        (draft) =>
          `## ${SOCIAL_PLATFORM_LABELS[draft.platform]}\nStatus: ${draft.status}\nSchedule: ${draft.scheduled_for || "unscheduled"}\n\n${draft.caption || "(no caption yet)"}\n`,
      ),
      "",
      "Images/exports: open Social Studio for this packet and download platform crops.",
    ].join("\n");

    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `post-pack-${sample.client_name || packetId}-${sample.event_date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-[var(--brand)]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Marketing Queue
          </h1>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Completed packets with consent auto-queue here (scheduled ~24h out).
          YouTube drafts prefer a video attachment
          {apiSet.has("youtube")
            ? " and can one-click Post when YouTube refresh-token or access-token credentials are configured (default privacy: unlisted)."
            : " — without YouTube API credentials, upload in YouTube Studio then Mark posted."}
          {isAdmin
            ? " Admins can post immediately or approve/deny requests from trainers. Ready API drafts past their schedule auto-publish hourly when social APIs are configured."
            : " Trainers request approval before anything goes live on company social accounts."}
        </p>
        {publishPlatforms.length ? (
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
            API publish ready:{" "}
            {publishPlatforms
              .map((p) => SOCIAL_PLATFORM_LABELS[p])
              .join(", ")}
            .
          </p>
        ) : null}
        {pendingCount > 0 ? (
          <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            {pendingCount} post{pendingCount === 1 ? "" : "s"} awaiting admin
            approval — use the Pending filter.
          </p>
        ) : null}
        {dueCount > 0 ? (
          <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            {dueCount} draft{dueCount === 1 ? "" : "s"} due now — use the Due
            filter.
          </p>
        ) : null}
        {missingConsentCount > 0 ? (
          <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            {missingConsentCount} draft
            {missingConsentCount === 1 ? "" : "s"} missing social consent on the
            packet — fix consent in Event Packets before posting or Mark posted.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {message}
        </p>
      ) : null}

      <label className="relative block max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search packets and drafts…"
          aria-label="Search packets and drafts"
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
        />
      </label>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Completed packets
        </h2>
        <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {packets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">
              No completed packets yet.
            </p>
          ) : visiblePackets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">
              No packets match “{query.trim()}”.
            </p>
          ) : (
            visiblePackets.map((packet) => (
              <div
                key={packet.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {packet.client_name || "Untitled"} · {packet.venue_label}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {packet.event_date} · {packet.dj_name} ·{" "}
                    {packet.social_consent ? "Consent ✓" : "No consent"} ·{" "}
                    {packet.caption_count}/{SOCIAL_PLATFORMS.length} captions ·{" "}
                    {packet.media_count} media · {packet.draft_count} drafts
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/social-studio/${packet.id}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover)]"
                  >
                    Social Studio
                  </Link>
                  <button
                    type="button"
                    onClick={() => downloadPostPack(packet.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Post pack
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => queuePacket(packet.id)}
                    className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Queue drafts
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Platform drafts
          </h2>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={[
                  "rounded-lg px-2.5 py-1 text-xs font-medium capitalize",
                  filter === item
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)]",
                ].join(" ")}
              >
                {item}
                {item === "due" && dueCount ? ` (${dueCount})` : ""}
                {item === "pending" && pendingCount
                  ? ` (${pendingCount})`
                  : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
              {searching
                ? `No drafts match “${query.trim()}” in this filter.`
                : "No drafts in this filter. Complete a packet with consent (auto queues) or queue manually above."}
            </p>
          ) : (
            visible.map((draft) => {
              const canAct =
                draft.status !== "posted" &&
                draft.status !== "skipped" &&
                draft.status !== "pending_approval";
              const isPending = draft.status === "pending_approval";
              const packetMedia = mediaByPacketId[draft.packet_id] ?? [];
              const selectableMedia = compatibleMediaForPlatform(
                draft.platform,
                packetMedia,
              );
              const hasConsent =
                consentByPacketId.get(draft.packet_id) !== false;
              const selectedIds =
                draft.media_ids?.length > 0
                  ? draft.media_ids
                  : draft.media_id
                    ? [draft.media_id]
                    : selectableMedia[0]
                      ? [selectableMedia[0].id]
                      : [];
              const selectedHasImage = selectedIds.some((id) => {
                const item = packetMedia.find((m) => m.id === id);
                return item ? isImageMediaItem(item) : false;
              });
              const pinterestNeedsImage =
                draft.platform === "pinterest" && !selectedHasImage;
              const needsCaption = !captionFor(draft).trim();
              const postBlocked =
                !hasConsent || pinterestNeedsImage || needsCaption;

              return (
                <article
                  key={draft.id}
                  className={[
                    "rounded-xl border bg-[var(--surface)] p-4",
                    isPending
                      ? "border-amber-400 dark:border-amber-600"
                      : isDue(draft)
                        ? "border-amber-300 dark:border-amber-700"
                        : "border-[var(--border)]",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        {SOCIAL_PLATFORM_LABELS[draft.platform]} ·{" "}
                        {draft.client_name}
                        {isPending ? " · Pending approval" : ""}
                        {isDue(draft) ? " · Due" : ""}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {draft.event_date} · {draft.venue_label} ·{" "}
                        {draft.status}
                        {draft.external_post_id
                          ? ` · Meta ${draft.external_post_id}`
                          : ""}
                        {draft.notes ? ` · ${draft.notes}` : ""}
                      </p>
                      {draft.publish_error ? (
                        <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                          Publish error: {draft.publish_error}
                        </p>
                      ) : null}
                      {!hasConsent && canAct ? (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                          Social consent is missing on this packet — posting is
                          blocked until consent is recorded.
                        </p>
                      ) : null}
                      {draft.platform === "youtube" && canAct ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          YouTube: pick a video, upload it in YouTube Studio, then
                          Mark posted (or Request approval for admins).
                        </p>
                      ) : null}
                      {pinterestNeedsImage && canAct ? (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                          Pinterest needs at least one image selected before
                          posting.
                        </p>
                      ) : null}
                      {needsCaption && canAct ? (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                          Add a caption first — Post for Me rejects empty
                          captions.
                        </p>
                      ) : null}
                      {draft.rejection_reason ? (
                        <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                          Denied: {draft.rejection_reason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {accountsForDraft(draft).length >= 1 ? (
                        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                          <span className="whitespace-nowrap">Post as</span>
                          <select
                            value={selectedTargetFor(draft)}
                            disabled={pending || !canAct}
                            onChange={(e) =>
                              setTargetAccount(draft, e.target.value)
                            }
                            className="max-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] disabled:opacity-50"
                            aria-label={`Post as brand for ${SOCIAL_PLATFORM_LABELS[draft.platform]}`}
                          >
                            {accountsForDraft(draft).length >= 2 ? (
                              <option value="">Choose brand…</option>
                            ) : null}
                            {accountsForDraft(draft).map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.username}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {draft.platform === "pinterest" &&
                      pinterestBoards.length > 0 ? (
                        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                          <span className="whitespace-nowrap">Board</span>
                          <select
                            value={selectedBoardFor(draft)}
                            disabled={pending || !canAct}
                            onChange={(e) =>
                              setPinterestBoard(draft, e.target.value)
                            }
                            className="max-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] disabled:opacity-50"
                            aria-label="Pinterest board"
                            title="Pins only to the selected board; Default board uses the account default"
                          >
                            <option value="">Default board</option>
                            {pinterestBoards.map((board) => (
                              <option key={board.id} value={board.board_id}>
                                {board.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => copyCaption(draft)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                      >
                        {copiedId === draft.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copy
                      </button>

                      {canAct ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setStatus(draft.id, "ready")}
                          className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                        >
                          Ready
                        </button>
                      ) : null}

                      {isAdmin && isPending ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              pending || pinterestNeedsImage || needsCaption
                            }
                            onClick={() => approve(draft)}
                            title={
                              needsCaption
                                ? "Add a caption first"
                                : pinterestNeedsImage
                                  ? "Select an image for this Pinterest pin"
                                  : undefined
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {publishingId === draft.id
                              ? "Approving…"
                              : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => deny(draft)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
                          >
                            <ShieldX className="h-3.5 w-3.5" />
                            Deny
                          </button>
                        </>
                      ) : null}

                      {canAct && apiSet.has(draft.platform) ? (
                        <button
                          type="button"
                          disabled={pending || postBlocked}
                          onClick={() => submitPublish(draft)}
                          title={
                            needsCaption
                              ? "Add a caption first"
                              : pinterestNeedsImage
                                ? "Select an image for this Pinterest pin"
                                : !hasConsent
                                  ? "Social consent required"
                                  : undefined
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {publishingId === draft.id
                            ? isAdmin
                              ? "Posting…"
                              : "Requesting…"
                            : isAdmin
                              ? `Post to ${SOCIAL_PLATFORM_LABELS[draft.platform]}`
                              : "Request approval"}
                        </button>
                      ) : null}

                      {canAct && !apiSet.has(draft.platform) ? (
                        isAdmin ? (
                          <button
                            type="button"
                            disabled={pending || !hasConsent}
                            onClick={() => markPosted(draft)}
                            className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                            title={
                              draft.platform === "youtube"
                                ? "After uploading in YouTube Studio"
                                : undefined
                            }
                          >
                            {publishingId === draft.id
                              ? "Saving…"
                              : draft.platform === "youtube"
                                ? "Mark posted (Studio)"
                                : "Mark posted"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending || !hasConsent}
                            onClick={() => requestApproval(draft)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {publishingId === draft.id
                              ? "Requesting…"
                              : "Request approval"}
                          </button>
                        )
                      ) : null}

                      {canAct ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setStatus(draft.id, "skipped")}
                          className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]"
                        >
                          Skip
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <DraftMediaPicker
                    draftId={draft.id}
                    platform={draft.platform}
                    items={selectableMedia}
                    selectedIds={selectedIds}
                    canAct={canAct}
                    pending={pending}
                    onChange={(mediaIds) => saveMedia(draft.id, mediaIds)}
                  />

                  {draft.platform === "instagram" ? (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-[var(--muted)]">
                        Instagram collaborators
                        <input
                          type="text"
                          defaultValue={(draft.ig_collaborators ?? [])
                            .map((name) => `@${name}`)
                            .join(", ")}
                          placeholder="@username1, @username2 (max 3)"
                          disabled={
                            pending ||
                            draft.status === "posted" ||
                            draft.status === "skipped" ||
                            draft.status === "rejected"
                          }
                          onBlur={(event) => {
                            const next = normalizeIgCollaborators(
                              event.target.value,
                            ).usernames;
                            const prev = draft.ig_collaborators ?? [];
                            if (next.join(",") !== prev.join(",")) {
                              saveCollaborators(draft.id, event.target.value);
                            }
                          }}
                          className="mt-1 h-9 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] disabled:opacity-60"
                        />
                      </label>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Invites go out when this draft is published. Collaborators
                        must accept in Instagram before the post appears on their
                        profile. Professional accounts only.
                      </p>
                    </div>
                  ) : null}

                  <label className="mt-3 block text-xs font-medium text-[var(--muted)]">
                    Schedule
                    <input
                      type="datetime-local"
                      defaultValue={toLocalInputValue(draft.scheduled_for)}
                      onBlur={(event) => {
                        const next = event.target.value;
                        const prev = toLocalInputValue(draft.scheduled_for);
                        if (next !== prev) saveSchedule(draft.id, next);
                      }}
                      className="mt-1 h-9 w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]"
                    />
                  </label>

                  <textarea
                    value={captionFor(draft)}
                    rows={5}
                    placeholder="Caption from Social Studio will appear here after generate/save or Queue drafts…"
                    onChange={(event) => {
                      const value = event.target.value;
                      setCaptionByDraft((prev) => ({
                        ...prev,
                        [draft.id]: value,
                      }));
                    }}
                    onBlur={(event) => {
                      if (event.target.value !== draft.caption) {
                        saveCaption(draft.id, event.target.value);
                      }
                    }}
                    className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </article>
              );
            })
          )}
        </div>
      </section>

      {isAdmin ? <PinterestBoardsAdmin boards={pinterestBoards} /> : null}
    </div>
  );
}

function DraftMediaPicker({
  draftId,
  platform,
  items,
  selectedIds,
  canAct,
  pending,
  onChange,
}: {
  draftId: string;
  platform: SocialPlatform;
  items: MarketingMediaOption[];
  selectedIds: string[];
  canAct: boolean;
  pending: boolean;
  onChange: (mediaIds: string[]) => void;
}) {
  const [displayUrls, setDisplayUrls] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(
    selectedIds[0] ?? null,
  );
  const rule = PLATFORM_MEDIA_RULES[platform];

  const resolvedFocusId =
    focusId && selectedIds.includes(focusId)
      ? focusId
      : (selectedIds[0] ?? null);

  const selectedItems = selectedIds
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean) as MarketingMediaOption[];
  const preview =
    selectedItems.find((item) => item.id === resolvedFocusId) ??
    selectedItems[0] ??
    null;
  const previewUrl =
    (preview ? displayUrls[preview.id] : null) ?? preview?.signed_url ?? null;
  const previewIsVideo = preview ? isVideoMediaItem(preview) : false;

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function load() {
      const next: Record<string, string> = {};
      await Promise.all(
        items.map(async (item) => {
          if (!item.signed_url) return;
          if (isVideoMediaItem(item)) {
            next[item.id] = item.signed_url;
            return;
          }
          try {
            const url = await resolveDisplayableImageUrl({
              url: item.signed_url,
              fileName: item.file_name,
            });
            if (cancelled) {
              if (url.startsWith("blob:")) URL.revokeObjectURL(url);
              return;
            }
            if (url.startsWith("blob:")) objectUrls.push(url);
            next[item.id] = url;
          } catch {
            next[item.id] = item.signed_url;
          }
        }),
      );
      if (!cancelled) setDisplayUrls(next);
    }

    void load();
    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [items, draftId]);

  function toggle(item: MarketingMediaOption) {
    setLocalError(null);
    const exists = selectedIds.includes(item.id);
    const nextIds = exists
      ? selectedIds.filter((id) => id !== item.id)
      : [...selectedIds, item.id];
    const nextSelected = nextIds
      .map((id) => items.find((row) => row.id === id))
      .filter(Boolean) as MarketingMediaOption[];

    const validation = validateDraftMediaSelection({
      platform,
      selected: nextSelected,
    });
    if (validation.error) {
      setLocalError(validation.error);
      return;
    }

    setFocusId(item.id);
    onChange(validation.mediaIds);
  }

  function moveSelected(mediaId: string, direction: -1 | 1) {
    const index = selectedIds.indexOf(mediaId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-[var(--muted)]">
          Media · {selectedIds.length}/{rule.max} selected
        </p>
        <p className="text-[11px] text-[var(--muted)]">
          {platformMediaLimitLabel(platform)}. Click to toggle; order = post order.
        </p>
      </div>

      {localError ? (
        <p className="text-xs text-red-700 dark:text-red-300">{localError}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          {platform === "youtube"
            ? "No videos on this packet yet — YouTube drafts need a video."
            : "No photos or videos on this packet yet."}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
            <div className="flex min-h-44 items-center justify-center bg-black/80 p-2">
              {previewUrl ? (
                previewIsVideo ? (
                  <video
                    key={preview?.id}
                    src={previewUrl}
                    controls
                    playsInline
                    className="max-h-56 w-full object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={preview?.file_name ?? "Selected media"}
                    className="max-h-56 w-full object-contain"
                  />
                )
              ) : (
                <p className="text-xs text-white/70">
                  Select one or more photos/videos below.
                </p>
              )}
            </div>
            {selectedItems.length > 1 ? (
              <div className="flex flex-wrap gap-1 border-t border-[var(--border)] px-2 py-1.5">
                {selectedItems.map((item, index) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px]"
                  >
                    <button
                      type="button"
                      className="font-medium text-[var(--foreground)]"
                      onClick={() => setFocusId(item.id)}
                    >
                      {index + 1}. {item.file_name.slice(0, 18)}
                      {item.file_name.length > 18 ? "…" : ""}
                    </button>
                    {canAct ? (
                      <>
                        <button
                          type="button"
                          disabled={pending || index === 0}
                          onClick={() => moveSelected(item.id, -1)}
                          className="text-[var(--muted)] disabled:opacity-30"
                          aria-label="Move earlier"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={pending || index === selectedItems.length - 1}
                          onClick={() => moveSelected(item.id, 1)}
                          className="text-[var(--muted)] disabled:opacity-30"
                          aria-label="Move later"
                        >
                          ↓
                        </button>
                      </>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
            {items.map((item) => {
              const order = selectedIds.indexOf(item.id);
              const selectedItem = order >= 0;
              const url = displayUrls[item.id] ?? item.signed_url;
              const video = isVideoMediaItem(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={pending || !canAct}
                  onClick={() => toggle(item)}
                  className={[
                    "overflow-hidden rounded-lg border text-left",
                    selectedItem
                      ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/40"
                      : "border-[var(--border)] hover:border-[var(--brand)]/50",
                    !canAct ? "opacity-60" : "",
                  ].join(" ")}
                  title={item.file_name}
                >
                  <div className="relative aspect-square bg-[var(--background)]">
                    {url ? (
                      video ? (
                        <video
                          src={url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--muted)]">
                        {video ? (
                          <Video className="h-5 w-5" />
                        ) : (
                          <ImageIcon className="h-5 w-5" />
                        )}
                      </div>
                    )}
                    {selectedItem ? (
                      <span className="absolute top-1 left-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
                        {order + 1}
                      </span>
                    ) : null}
                    {video ? (
                      <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-medium text-white">
                        Video
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
