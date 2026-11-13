"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  saveEventPacketAction,
  syncPacketMediaFromRecapAction,
} from "@/app/(app)/event-packets/actions";
import {
  PacketMediaList,
  type PacketMediaListItem,
} from "@/components/event-packets/packet-media-list";
import { PacketMediaUpload } from "@/components/event-packets/packet-media-upload";
import { PacketStatusBadge } from "@/components/event-packets/packet-status-badge";
import { formatPacketEventType } from "@/lib/event-packets/format-event-type";
import {
  isWeddingEventType,
  WEDDING_DAY_OF_CHECKLIST,
} from "@/lib/event-packets/wedding-day-checklist";
import type { EventPacket } from "@/lib/types/event-packets";
import { EVENT_TYPES, type EventType } from "@/lib/types/event-reports";

type PacketCompleteFormProps = {
  packet: EventPacket;
  media: PacketMediaListItem[];
  venues: { id: string; name: string }[];
  currentUserId: string;
  isAdmin: boolean;
  isTrainer?: boolean;
  /** Linked Pipeline mirror project label (admins/Leads). */
  pipelineProjectName?: string | null;
};

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]";

export function PacketCompleteForm({
  packet,
  media,
  venues,
  currentUserId,
  isAdmin,
  isTrainer = false,
  pipelineProjectName = null,
}: PacketCompleteFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType>(
    EVENT_TYPES.includes(packet.event_type as EventType)
      ? (packet.event_type as EventType)
      : "Other",
  );
  const [eventTypeOther, setEventTypeOther] = useState(
    packet.event_type_other ?? "",
  );
  const [followUpNeeded, setFollowUpNeeded] = useState(packet.follow_up_needed);
  const [socialConsent, setSocialConsent] = useState(
    Boolean(packet.social_consent),
  );
  const [rating, setRating] = useState(packet.rating ?? 5);
  const [venueId, setVenueId] = useState(packet.venue_id ?? "");
  const [venueRaw, setVenueRaw] = useState(
    packet.venue?.name || packet.venue_raw || "",
  );
  const [clientName, setClientName] = useState(packet.client_name ?? "");
  const [djName, setDjName] = useState(packet.dj_name ?? "");
  const [eventDate, setEventDate] = useState(packet.event_date ?? "");
  const [completedNow, setCompletedNow] = useState(
    packet.status === "completed",
  );
  const [mediaSyncMessage, setMediaSyncMessage] = useState<string | null>(null);
  const [mediaSyncPending, startMediaSync] = useTransition();

  const locationName =
    venues.find((venue) => venue.id === venueId)?.name ||
    venueRaw ||
    packet.venue?.name ||
    packet.venue_raw;

  const mediaTagsFromRecap = {
    dj_name: djName,
    location_name: locationName,
    event_date: eventDate,
    client_name: clientName,
    event_type: formatPacketEventType({
      event_type: eventType,
      event_type_other: eventTypeOther,
    }),
  };

  function submitForm(form: HTMLFormElement, markCompleted: boolean) {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await saveEventPacketAction(packet.id, {
        client_name: clientName,
        venue_raw: venueRaw,
        venue_id: venueId || null,
        event_type: eventType,
        event_type_other: eventTypeOther,
        dj_name: djName,
        event_date: eventDate,
        memorable_moment: String(
          new FormData(form).get("memorable_moment") ?? "",
        ),
        equipment_notes: String(
          new FormData(form).get("equipment_notes") ?? "",
        ),
        issues: String(new FormData(form).get("issues") ?? ""),
        client_feedback: String(
          new FormData(form).get("client_feedback") ?? "",
        ),
        rating,
        follow_up_needed: followUpNeeded,
        follow_up_notes: String(
          new FormData(form).get("follow_up_notes") ?? "",
        ),
        social_consent: socialConsent,
        social_consent_notes: String(
          new FormData(form).get("social_consent_notes") ?? "",
        ),
        mark_completed: markCompleted,
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      if (markCompleted) {
        setCompletedNow(true);
        setMessage(
          socialConsent
            ? "Packet marked complete. Marketing drafts were queued (~24h). Generate captions in Social Studio if needed."
            : "Packet marked complete. A linked End of Event Report was saved — open Social Studio next for captions.",
        );
      } else {
        setMessage("Progress saved.");
      }
      router.refresh();
    });
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitForm(event.currentTarget, false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">Event packet</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {packet.client_name || "Untitled client"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {packet.event_date} · {locationName} ·{" "}
            {formatPacketEventType(packet)}
          </p>
          {packet.folder_name ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Folder: {packet.folder_name}
            </p>
          ) : null}
          <p className="mt-2 text-xs">
            <Link
              href={`/event-checklist/open?packet=${packet.id}`}
              className="font-medium text-[var(--brand)] hover:underline"
            >
              Open gear checklist
            </Link>
          </p>
          {pipelineProjectName &&
          packet.pipeline_project_id &&
          (isAdmin || isTrainer) ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              CRM project:{" "}
              <Link
                href="/pipeline"
                className="font-medium text-[var(--brand)] hover:underline"
              >
                {pipelineProjectName}
              </Link>
              <span className="text-[var(--muted)]">
                {" "}
                (Pipeline mirror — Projects tab)
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <PacketStatusBadge status={packet.status} />
          {packet.completion_optional ? (
            <span className="inline-flex rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
              Optional archive
            </span>
          ) : null}
          {completedNow || packet.status === "completed" ? (
            <Link
              href={`/social-studio/${packet.id}`}
              className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Open in Social Studio →
            </Link>
          ) : null}
        </div>
      </div>

      {isWeddingEventType(eventType) ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Wedding day-of checklist
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Quick reference for coordinators — not saved on the packet.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--foreground)]">
            {WEDDING_DAY_OF_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {packet.completion_optional && packet.status !== "completed" ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          Optional archive packet from a website review — fill this in only if
          you have photos or notes to add. It is never overdue and does not
          appear on For You or affect Hub points.
        </div>
      ) : null}

      {completedNow || packet.status === "completed" ? (
        <div className="rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-soft)]/40 px-4 py-3 text-sm text-[var(--foreground)]">
          Ready for social?{" "}
          <Link
            href={`/social-studio/${packet.id}`}
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            Generate captions and image exports in Social Studio
          </Link>
          .
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Event details &amp; recap
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Event date</span>
            <input
              name="event_date"
              type="date"
              required
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Team member</span>
            <input
              name="dj_name"
              required
              value={djName}
              onChange={(event) => setDjName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Client</span>
            <input
              name="client_name"
              required
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Event type</span>
            <select
              value={eventType}
              onChange={(event) =>
                setEventType(event.target.value as EventType)
              }
              className={inputClass}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {eventType === "Other" ? (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">
                Describe this event type
              </span>
              <input
                value={eventTypeOther}
                onChange={(event) => setEventTypeOther(event.target.value)}
                required
                placeholder="e.g. Quinceañera, Fundraiser, Private party"
                className={inputClass}
              />
            </label>
          ) : null}
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Venue / location</span>
            <input
              value={venueRaw}
              onChange={(event) => {
                setVenueRaw(event.target.value);
                const match = venues.find(
                  (venue) =>
                    venue.name.toLowerCase() ===
                    event.target.value.trim().toLowerCase(),
                );
                setVenueId(match?.id ?? "");
              }}
              list="venue-masters"
              required
              className={inputClass}
            />
            <datalist id="venue-masters">
              {venues.map((venue) => (
                <option key={venue.id} value={venue.name} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Memorable moment</span>
          <textarea
            name="memorable_moment"
            rows={3}
            defaultValue={packet.memorable_moment}
            placeholder="A highlight worth sharing in social captions…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Equipment notes</span>
          <textarea
            name="equipment_notes"
            rows={3}
            defaultValue={packet.equipment_notes}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Issues</span>
          <textarea
            name="issues"
            rows={3}
            defaultValue={packet.issues}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Client feedback</span>
          <textarea
            name="client_feedback"
            rows={3}
            defaultValue={packet.client_feedback}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>

        <div>
          <p className="mb-1 text-sm font-medium">Rating</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={[
                  "h-9 w-9 rounded-lg border text-sm font-semibold",
                  rating === value
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border)]",
                ].join(" ")}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={followUpNeeded}
            onChange={(event) => setFollowUpNeeded(event.target.checked)}
          />
          Follow-up needed by admin
        </label>
        {followUpNeeded ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Notes for admin follow-up
            </span>
            <textarea
              name="follow_up_notes"
              rows={2}
              defaultValue={packet.follow_up_notes}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={socialConsent}
            onChange={(event) => setSocialConsent(event.target.checked)}
            className="mt-1"
          />
          <span>
            Client consented to social media use of event photos/videos
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Required before posting publicly. Captions can still be drafted
              without consent, but mark this when cleared.
            </span>
          </span>
        </label>
        {socialConsent ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Consent notes (optional)</span>
            <textarea
              name="social_consent_notes"
              rows={2}
              defaultValue={packet.social_consent_notes ?? ""}
              placeholder="How consent was given (verbal, written, contract, etc.)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save progress"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) submitForm(form, true);
            }}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Mark complete
          </button>
        </div>
      </form>

      <PacketMediaUpload
        packetId={packet.id}
        recapTags={mediaTagsFromRecap}
      />

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Uploaded for this packet
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Click a photo or video to preview it. Use the trash icon to remove
              an upload if needed. If you changed Event details &amp; recap after
              uploading, sync tags and folder names from the recap.
            </p>
          </div>
          {media.length > 0 ? (
            <button
              type="button"
              disabled={mediaSyncPending}
              onClick={() => {
                setMediaSyncMessage(null);
                setError(null);
                startMediaSync(async () => {
                  const result = await syncPacketMediaFromRecapAction(
                    packet.id,
                  );
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setMediaSyncMessage(
                    result.message ??
                      `Synced ${result.updated ?? 0} file(s) from Event details & recap.`,
                  );
                  router.refresh();
                });
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {mediaSyncPending
                ? "Syncing…"
                : "Sync tags from Event details"}
            </button>
          ) : null}
        </div>
        {mediaSyncMessage ? (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
            {mediaSyncMessage}
          </p>
        ) : null}
        <PacketMediaList
          media={media}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          isTrainer={isTrainer}
          isAssignee={packet.assignee_id === currentUserId}
        />
      </section>
    </div>
  );
}
