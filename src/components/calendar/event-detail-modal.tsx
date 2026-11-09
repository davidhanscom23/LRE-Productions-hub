"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  FolderPlus,
  MapPin,
  X,
} from "lucide-react";
import { createPacketFromPastEventAction } from "@/app/(app)/event-packets/actions";
import { saveEventAssignmentsAction } from "@/app/(app)/calendar/actions";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { StaffAvailabilityEntry } from "@/lib/calendar/availability";
import {
  formatDescriptionTimeRange,
  formatEventDetailsCopy,
  googleMapsSearchUrl,
  statusBadgeClass,
} from "@/lib/calendar/format";
import { isManualPacketEligible } from "@/lib/event-packets/eligibility";

type EventDetailModalProps = {
  event: CalendarEvent;
  onClose: () => void;
  canAssignStaff?: boolean;
  assignableStaff?: StaffAvailabilityEntry[];
};

export function EventDetailModal({
  event,
  onClose,
  canAssignStaff = false,
  assignableStaff = [],
}: EventDetailModalProps) {
  const router = useRouter();
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const [packetError, setPacketError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => event.assignedProfileIds ?? [],
  );
  const [packetPending, startPacketTransition] = useTransition();
  const [assignPending, startAssignTransition] = useTransition();
  const canCreatePacket =
    event.source === "work" && isManualPacketEligible(event);
  const showAssign =
    canAssignStaff &&
    (event.source === "work" || event.source === "honeybook") &&
    assignableStaff.length > 0;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rows: { label: string; value: string; href?: string }[] = [];

  if (event.eventType) rows.push({ label: "Event Type", value: event.eventType });
  if (event.assignedStaff) {
    rows.push({ label: "Assigned Staff", value: event.assignedStaff });
  }
  rows.push({ label: "Time", value: formatDescriptionTimeRange(event) });
  if (event.status) rows.push({ label: "Status", value: event.status });
  if (event.venue) rows.push({ label: "Venue", value: event.venue });
  if (event.clientName) {
    rows.push({ label: "Client Name", value: event.clientName });
  }
  if (event.organization) {
    rows.push({ label: "Organization", value: event.organization });
  }
  if (event.clientContact) {
    rows.push({ label: "Client Contact", value: event.clientContact });
  }
  if (event.clientPhone) {
    rows.push({
      label: "Client Phone",
      value: event.clientPhone,
      href: `tel:${event.clientPhone}`,
    });
  }
  if (event.clientEmail) {
    rows.push({
      label: "Client Email",
      value: event.clientEmail,
      href: `mailto:${event.clientEmail}`,
    });
  }
  if (event.planningFormUrl) {
    const planningTitle =
      event.relatedFiles?.find((f) => f.url === event.planningFormUrl)?.title ??
      "Open planning form";
    rows.push({
      label: "Planning Form",
      value: planningTitle,
      href: event.planningFormUrl,
    });
  }
  for (const file of event.relatedFiles ?? []) {
    // Avoid duplicating the planning form row or the scheduler link button.
    if (event.planningFormUrl && file.url === event.planningFormUrl) continue;
    if (event.eventUrl && file.url === event.eventUrl) continue;
    rows.push({
      label: "Event Planning",
      value: file.title,
      href: file.url,
    });
  }

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(formatEventDetailsCopy(event));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/30 backdrop-blur-[2px]"
        aria-label="Close event details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              {event.title}
            </h2>
            {event.status ? (
              <span
                className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(event.status)}`}
              >
                {event.status}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={`${row.label}:${row.href ?? row.value}`}>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {row.label}
              </dt>
              <dd className="mt-0.5 text-sm text-[var(--foreground)]">
                {row.label === "Venue" ? (
                  <a
                    href={googleMapsSearchUrl(row.value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1.5 text-[var(--brand)] hover:underline"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{row.value}</span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                  </a>
                ) : row.href ? (
                  <a
                    href={row.href}
                    target={row.href.startsWith("http") ? "_blank" : undefined}
                    rel={
                      row.href.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="inline-flex items-start gap-1.5 text-[var(--brand)] hover:underline"
                  >
                    {row.label === "Planning Form" ||
                    row.label === "Event Planning" ||
                    row.label === "Related File" ? (
                      <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : null}
                    <span className="break-all">{row.value}</span>
                    {row.href.startsWith("http") ? (
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                    ) : null}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {showAssign ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Assign staff
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              HoneyBook doesn’t send who is working the event — pick team
              members here. Staff already assigned on the HoneyBook board
              show up here automatically. They show as Booked on Staff
              Availability.
            </p>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {assignableStaff
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((person) => {
                  const checked = selectedIds.includes(person.id);
                  return (
                    <label
                      key={person.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== person.id)
                              : [...prev, person.id],
                          );
                        }}
                        className="rounded border-[var(--border)]"
                      />
                      <span className="text-[var(--foreground)]">
                        {person.name}
                      </span>
                    </label>
                  );
                })}
            </div>
            {assignError ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {assignError}
              </p>
            ) : null}
            {assignMessage ? (
              <p className="mt-2 text-sm text-[var(--brand)]">{assignMessage}</p>
            ) : null}
            <button
              type="button"
              disabled={assignPending}
              onClick={() => {
                setAssignError(null);
                setAssignMessage(null);
                startAssignTransition(async () => {
                  const result = await saveEventAssignmentsAction({
                    eventUid: event.uid,
                    profileIds: selectedIds,
                  });
                  if (result.error) {
                    setAssignError(result.error);
                    return;
                  }
                  setAssignMessage("Staff assignment saved.");
                  router.refresh();
                });
              }}
              className="mt-3 inline-flex items-center rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {assignPending ? "Saving…" : "Save assignments"}
            </button>
          </div>
        ) : null}

        {packetError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {packetError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {canCreatePacket ? (
            <button
              type="button"
              disabled={packetPending}
              onClick={() => {
                setPacketError(null);
                startPacketTransition(async () => {
                  const result = await createPacketFromPastEventAction(
                    event.uid,
                  );
                  if (result.error || !result.packetId) {
                    setPacketError(
                      result.error ?? "Could not create event packet.",
                    );
                    return;
                  }
                  onClose();
                  router.push(`/event-packets/${result.packetId}`);
                  router.refresh();
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {packetPending ? "Creating packet…" : "Create Event Packet"}
            </button>
          ) : null}
          {event.source !== "timeoff" ? (
            <a
              href={
                event.crmProjectId
                  ? `/event-checklist/${event.crmProjectId}`
                  : `/event-checklist/open?uid=${encodeURIComponent(event.uid)}&date=${encodeURIComponent(event.allDay ? event.start.slice(0, 10) : new Date(event.start).toLocaleDateString("en-CA", { timeZone: "America/New_York" }))}&title=${encodeURIComponent(event.clientName ?? event.title)}`
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
            >
              Gear checklist
            </a>
          ) : null}
          {event.venue ? (
            <a
              href={googleMapsSearchUrl(event.venue)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
            >
              <MapPin className="h-3.5 w-3.5" />
              Open in Maps
            </a>
          ) : null}
          {event.planningFormUrl ? (
            <a
              href={event.planningFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Planning form
            </a>
          ) : null}
          {(event.relatedFiles ?? [])
            .filter(
              (file) =>
                file.url !== event.planningFormUrl &&
                file.url !== event.eventUrl,
            )
            .map((file) => (
              <a
                key={file.url}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                {file.title}
              </a>
            ))}
          {event.eventUrl ? (
            <a
              href={event.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in scheduler
            </a>
          ) : null}
          <button
            type="button"
            onClick={copyDetails}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy details"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:text-xs ${statusBadgeClass(status)}`}
      title={status}
    >
      {status}
    </span>
  );
}

export function useEventDetail() {
  const [active, setActive] = useState<CalendarEvent | null>(null);
  return {
    active,
    open: setActive,
    close: () => setActive(null),
  };
}

