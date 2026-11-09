"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { fetchCompanyCalendarEvents } from "@/lib/calendar/events";
import {
  getSharedWorkIcalUrl,
  isSharedCalendarConfigured,
} from "@/lib/calendar/settings";
import { MANUAL_PACKET_LOOKBACK_DAYS } from "@/lib/event-packets/eligibility";
import {
  buildEventFolderName,
  buildFolderPath,
  buildMediaFileName,
  extensionFromFileName,
  folderSlugFromName,
  normalizeVenueKey,
  sanitizeNamePart,
} from "@/lib/event-packets/naming";
import { isDriveConfigured } from "@/lib/drive/client";
import { syncPacketMediaToDrive } from "@/lib/drive/sync-media";
import {
  createPacketFromCalendarEvent,
  isManualPacketEligible,
  syncPacketsFromEvents,
  type LaunchablePastEvent,
} from "@/lib/event-packets/sync";
import { ensureVenueForName } from "@/lib/event-packets/venues";
import { queuePacketDrafts } from "@/lib/marketing/queue-packet";
import { notifyAdmins } from "@/lib/notifications/notify";
import { createClient } from "@/lib/supabase/server";
import type { EventPacketFormInput } from "@/lib/types/event-packets";
import { EVENT_TYPES, type EventType } from "@/lib/types/event-reports";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, profile: null, error: "You must be signed in." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile, error: null };
}

function revalidatePacketPaths(packetId?: string) {
  revalidatePath("/event-packets");
  revalidatePath("/end-of-event-report");
  revalidatePath("/submit-event-photos");
  revalidatePath("/social-studio");
  revalidatePath("/marketing");
  if (packetId) {
    revalidatePath(`/event-packets/${packetId}`);
    revalidatePath(`/social-studio/${packetId}`);
  }
}

export async function syncEventPacketsAction(): Promise<{
  error: string | null;
  created?: number;
  updated?: number;
  unmatchedStaff?: string[];
}> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) return { error: error ?? "You must be signed in." };

  const isAdmin = profile.role === "admin";

  try {
    // Bust the 15-minute ICS cache so Sync always pulls a fresh feed.
    revalidatePacketIcalCaches();

    const { collectAllDjepWorkEvents } = await import(
      "@/lib/calendar/collect-feeds"
    );
    const { withHubAssignments } = await import(
      "@/lib/calendar/load-assignments"
    );
    // Shared Vident HoneyBook calendar only — never personal DJEP feeds.
    const collected = await collectAllDjepWorkEvents(supabase);
    if (!collected.feedsScanned) {
      return {
        error: isAdmin
          ? "Connect the HoneyBook calendar on Calendar first."
          : "Ask an admin to connect the HoneyBook calendar on Calendar, then sync.",
      };
    }
    const events = await withHubAssignments(supabase, collected.events);

    const result = await syncPacketsFromEvents({
      supabase,
      events,
      onlyAssigneeId: isAdmin ? undefined : user.id,
      canCreateVenues: isAdmin,
      // Manual sync covers the same 24-month window as Client Reviews / Calendar.
      lookbackDays: MANUAL_PACKET_LOOKBACK_DAYS,
    });
    revalidatePacketPaths();
    revalidatePath("/client-reviews");
    revalidatePath("/calendar");
    return {
      error: result.error,
      created: result.created,
      updated: result.updated,
      unmatchedStaff: result.unmatchedStaff,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Calendar sync failed.",
    };
  }
}

/** Admin: pull website testimonials sheet and attach by Event_ID. */
export async function syncSheetReviewsAction(): Promise<{
  error: string | null;
  rowsRead?: number;
  upserted?: number;
  matched?: number;
  unmatched?: number;
  withEventId?: number;
  missingEventId?: number;
  packetsCreated?: number;
  calendarFeedsScanned?: number;
  calendarEventsLoaded?: number;
  calendarEventIdsFound?: number;
  reviewIdsOnCalendar?: number;
  packetsFromReviewsOnly?: number;
  skippedNoStaff?: number;
  pruned?: number;
  source?: string | null;
}> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }
  if (profile.role !== "admin") {
    return { error: "Only admins can sync website reviews." };
  }

  // Fresh calendar before bridge creates packets for review Event_IDs.
  revalidatePacketIcalCaches();

  const { syncExternalReviewsFromSheet } = await import(
    "@/lib/reviews/sync-sheet"
  );
  const result = await syncExternalReviewsFromSheet({
    writeClient: supabase,
  });
  if (!result.ok) {
    return { error: result.error ?? "Review sync failed." };
  }

  try {
    const { awardClientReviewMilestones } = await import(
      "@/lib/reviews/award-milestones"
    );
    const {
      createServiceClient,
      isServiceRoleConfigured,
    } = await import("@/lib/supabase/admin");
    if (isServiceRoleConfigured()) {
      await awardClientReviewMilestones(createServiceClient());
    } else {
      await awardClientReviewMilestones(supabase);
    }
  } catch {
    // Sync succeeded; milestone backfill is best-effort.
  }

  revalidatePacketPaths();
  revalidatePath("/social-studio");
  revalidatePath("/client-reviews");
  revalidatePath("/calendar");
  return {
    error: null,
    rowsRead: result.rowsRead,
    upserted: result.upserted,
    matched: result.matched,
    unmatched: result.unmatched,
    withEventId: result.withEventId,
    missingEventId: result.missingEventId,
    packetsCreated: result.packetsCreated,
    calendarFeedsScanned: result.calendarFeedsScanned,
    calendarEventsLoaded: result.calendarEventsLoaded,
    calendarEventIdsFound: result.calendarEventIdsFound,
    reviewIdsOnCalendar: result.reviewIdsOnCalendar,
    packetsFromReviewsOnly: result.packetsFromReviewsOnly,
    skippedNoStaff: result.skippedNoStaff,
    pruned: result.pruned,
    source: result.source,
  };
}

/** Shared Vident HoneyBook (or mirrored company) iCal — never personal DJEP. */
async function resolveIcalUrlForPackets(options: {
  role: string;
}): Promise<{ icalUrl: string | null; error: string | null }> {
  const configured = await isSharedCalendarConfigured();
  const icalUrl = configured ? await getSharedWorkIcalUrl() : null;
  if (icalUrl) return { icalUrl, error: null };

  return {
    icalUrl: null,
    error:
      options.role === "admin"
        ? "Connect the HoneyBook calendar on Calendar settings first."
        : "Ask an admin to connect the HoneyBook calendar on Calendar to launch packets from past events.",
  };
}

function revalidatePacketIcalCaches() {
  revalidateTag("honeybook-ical", "max");
  revalidateTag("company-ical", "max");
  revalidateTag("djep-ical", "max");
}

/**
 * Past / today calendar events the current user can still open a packet for
 * (no existing packet for them on that event).
 */
export async function listLaunchablePastEventsAction(): Promise<{
  error: string | null;
  events?: LaunchablePastEvent[];
}> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }
  if (profile.role === "guest") {
    return { error: "Guests cannot create event packets." };
  }

  const feed = await resolveIcalUrlForPackets({
    role: profile.role,
  });
  if (!feed.icalUrl) return { error: feed.error };

  try {
    // Prefer a fresh feed for this panel (avoid stale 15-min cache).
    revalidatePacketIcalCaches();

    const calendarEvents = await fetchCompanyCalendarEvents(feed.icalUrl);

    const byUid = new Map<string, (typeof calendarEvents)[number]>();
    for (const event of calendarEvents) {
      if (event.uid?.trim()) byUid.set(event.uid.trim(), event);
    }

    const { data: existing } = await supabase
      .from("event_packets")
      .select("calendar_uid")
      .eq("assignee_id", user.id)
      .not("calendar_uid", "is", null);

    const havePacket = new Set(
      (existing ?? [])
        .map((row) => String(row.calendar_uid ?? "").trim())
        .filter(Boolean),
    );

    const launchable: LaunchablePastEvent[] = [];
    for (const event of byUid.values()) {
      if (!isManualPacketEligible(event)) continue;
      if (!event.uid?.trim() || havePacket.has(event.uid.trim())) continue;

      // Shared Vident HoneyBook calendar only (no DJEP / Y Ent feeds).
      launchable.push({
        uid: event.uid,
        eventDate: event.start.slice(0, 10),
        clientName: event.clientName?.trim() || event.title || "Event",
        venue: event.venue?.trim() || "Unknown venue",
        eventType: event.eventType?.trim() || "Other",
        assignedStaff: event.assignedStaff?.trim() || "",
      });
    }

    launchable.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    return { error: null, events: launchable.slice(0, 200) };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not load calendar events.",
    };
  }
}

/** Staff/admin: create a packet for themselves from a past/today calendar event. */
export async function createPacketFromPastEventAction(
  calendarUid: string,
): Promise<{ error: string | null; packetId?: string; created?: boolean }> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }
  if (profile.role === "guest") {
    return { error: "Guests cannot create event packets." };
  }

  const uid = calendarUid.trim();
  if (!uid) return { error: "Pick an event first." };

  const feed = await resolveIcalUrlForPackets({
    role: profile.role,
  });
  if (!feed.icalUrl) return { error: feed.error };

  try {
    revalidatePacketIcalCaches();
    const calendarEvents = await fetchCompanyCalendarEvents(feed.icalUrl);
    const event = calendarEvents.find((row) => row.uid?.trim() === uid);
    if (!event) {
      return { error: "That calendar event was not found on your feed." };
    }

    const result = await createPacketFromCalendarEvent({
      supabase,
      event,
      assignee: {
        id: user.id,
        full_name: String(profile.full_name ?? ""),
        email: String(profile.email ?? ""),
        is_active: true,
      },
      canCreateVenues: profile.role === "admin",
    });

    if (result.error || !result.packetId) {
      return { error: result.error ?? "Could not create packet." };
    }

    revalidatePacketPaths(result.packetId);
    return {
      error: null,
      packetId: result.packetId,
      created: result.created,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not create packet from that event.",
    };
  }
}

export async function saveVenueAction(input: {
  name: string;
  aliases: string[];
  venueId?: string;
}): Promise<{ error: string | null; id?: string }> {
  const { supabase, profile, error } = await requireUser();
  if (error || !profile) return { error: error ?? "You must be signed in." };
  if (profile.role !== "admin") return { error: "Only admins can manage venues." };

  const name = input.name.trim();
  if (!name) return { error: "Venue name is required." };

  const folder_slug = folderSlugFromName(name);
  const now = new Date().toISOString();

  let venueId = input.venueId;
  if (venueId) {
    const { error: updateError } = await supabase
      .from("venues")
      .update({ name, folder_slug, updated_at: now })
      .eq("id", venueId);
    if (updateError) return { error: updateError.message };
    await supabase.from("venue_aliases").delete().eq("venue_id", venueId);
  } else {
    const { data, error: insertError } = await supabase
      .from("venues")
      .insert({ name, folder_slug, updated_at: now })
      .select("id")
      .single();
    if (insertError || !data) {
      return { error: insertError?.message ?? "Could not create venue." };
    }
    venueId = data.id as string;
  }

  const aliasRows = Array.from(
    new Set(
      [name, ...input.aliases]
        .map((alias) => alias.trim())
        .filter(Boolean)
        .map((alias) => normalizeVenueKey(alias)),
    ),
  ).map((alias) => ({ venue_id: venueId!, alias }));

  if (aliasRows.length) {
    const { error: aliasError } = await supabase
      .from("venue_aliases")
      .upsert(aliasRows, { onConflict: "alias" });
    if (aliasError) return { error: aliasError.message };
  }

  revalidatePacketPaths();
  return { error: null, id: venueId };
}

export async function deleteVenueAction(
  venueId: string,
): Promise<{ error: string | null }> {
  const { supabase, profile, error } = await requireUser();
  if (error || !profile) return { error: error ?? "You must be signed in." };
  if (profile.role !== "admin") return { error: "Only admins can manage venues." };

  const { error: deleteError } = await supabase
    .from("venues")
    .delete()
    .eq("id", venueId);
  if (deleteError) return { error: deleteError.message };

  revalidatePacketPaths();
  return { error: null };
}

export async function saveEventPacketAction(
  packetId: string,
  input: EventPacketFormInput,
): Promise<{ error: string | null }> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) return { error: error ?? "You must be signed in." };

  const { data: packet, error: fetchError } = await supabase
    .from("event_packets")
    .select("*")
    .eq("id", packetId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!packet) return { error: "Packet not found." };

  const isAdmin = profile.role === "admin";
  if (packet.assignee_id !== user.id && !isAdmin) {
    return { error: "You can only update your own event packets." };
  }

  if (!input.event_date) return { error: "Event date is required." };
  if (!input.client_name.trim()) return { error: "Client name is required." };
  if (!input.venue_raw.trim()) return { error: "Venue is required." };
  if (!EVENT_TYPES.includes(input.event_type as EventType)) {
    return { error: "Choose a valid event type." };
  }
  const eventTypeOther =
    input.event_type === "Other" ? input.event_type_other.trim() : "";
  if (input.event_type === "Other" && !eventTypeOther) {
    return { error: "Describe the event type when Other is selected." };
  }
  if (input.rating < 1 || input.rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  let venueId = input.venue_id;
  if (!venueId && isAdmin) {
    const ensured = await ensureVenueForName(input.venue_raw);
    venueId = ensured?.id ?? null;
  } else if (!venueId) {
    const { data: venues } = await supabase.from("venues").select("id, name");
    const match = (venues ?? []).find(
      (row) =>
        normalizeVenueKey(String(row.name)) ===
        normalizeVenueKey(input.venue_raw),
    );
    venueId = (match?.id as string | undefined) ?? packet.venue_id;
  }

  const locationName =
    (venueId
      ? (
          await supabase.from("venues").select("name").eq("id", venueId).maybeSingle()
        ).data?.name
      : null) || input.venue_raw.trim();

  const djName = input.dj_name.trim() || profile.full_name || profile.email || "Staff";
  const folderName = buildEventFolderName({
    locationName,
    djName,
    eventDate: input.event_date,
  });

  const status = input.mark_completed
    ? "completed"
    : packet.status === "completed"
      ? "completed"
      : "in_progress";

  const payload = {
    client_name: input.client_name.trim(),
    venue_raw: input.venue_raw.trim(),
    venue_id: venueId,
    event_type: input.event_type,
    event_type_other: eventTypeOther,
    dj_name: djName,
    event_date: input.event_date,
    memorable_moment: input.memorable_moment.trim(),
    hours_worked: "",
    equipment_notes: input.equipment_notes.trim(),
    issues: input.issues.trim(),
    client_feedback: input.client_feedback.trim(),
    rating: input.rating,
    follow_up_needed: input.follow_up_needed,
    follow_up_notes: input.follow_up_needed ? input.follow_up_notes.trim() : "",
    social_consent: Boolean(input.social_consent),
    social_consent_notes: input.social_consent
      ? input.social_consent_notes.trim()
      : "",
    folder_name: folderName,
    status,
    completed_at:
      status === "completed"
        ? packet.completed_at ?? new Date().toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("event_packets")
    .update(payload)
    .eq("id", packetId);

  if (updateError) return { error: updateError.message };

  // Event details & recap is master — rewrite tags, folders, and storage keys
  // on every photo/video already attached when they don't match the recap.
  try {
    const { ensurePacketMediaMatchesRecap } = await import(
      "@/lib/event-packets/sync-media-from-recap"
    );
    await ensurePacketMediaMatchesRecap({
      supabase,
      packetId,
      venueId: venueId ?? null,
      clientName: payload.client_name,
      venueRaw: locationName,
      eventType: String(payload.event_type),
      eventTypeOther,
      djName,
      eventDate: payload.event_date,
    });
  } catch {
    // Packet save still succeeds if media re-tag fails.
  }

  const firstCompletion =
    status === "completed" && packet.status !== "completed";
  // Archive / review-backfill packets never earn packet_24h.
  const isOptional = Boolean(
    (packet as { completion_optional?: boolean | null }).completion_optional,
  );
  if (firstCompletion && !isOptional) {
    try {
      const queuedAt = new Date(
        String(
          (packet as { queued_at?: string | null }).queued_at ??
            packet.created_at,
        ),
      ).getTime();
      const completedAt = new Date(
        String(payload.completed_at ?? new Date().toISOString()),
      ).getTime();
      if (
        Number.isFinite(queuedAt) &&
        Number.isFinite(completedAt) &&
        completedAt - queuedAt <= 24 * 3600 * 1000
      ) {
        const { awardAchievementTo } = await import("@/lib/points/hub-points");
        const assigneeId = String(packet.assignee_id);
        if (assigneeId === user.id || isAdmin) {
          await awardAchievementTo(supabase, assigneeId, "packet_24h", {
            packet_id: packetId,
          });
        } else {
          const { createServiceClient, isServiceRoleConfigured } = await import(
            "@/lib/supabase/admin"
          );
          if (isServiceRoleConfigured()) {
            await awardAchievementTo(
              createServiceClient(),
              assigneeId,
              "packet_24h",
              { packet_id: packetId },
            );
          }
        }
      }
    } catch {
      // non-critical
    }
  }

  if (payload.follow_up_needed && !packet.follow_up_needed) {
    const clientLabel = payload.client_name || "Untitled client";
    const staffLabel =
      profile.full_name?.trim() || profile.email || "A teammate";
    const notesSnippet = payload.follow_up_notes
      ? ` — ${payload.follow_up_notes.slice(0, 120)}`
      : "";
    try {
      await notifyAdmins(supabase, {
        kind: "packet_follow_up",
        title: "Event Packet needs follow-up by admin",
        body: `${staffLabel} flagged ${clientLabel} (${payload.event_date})${notesSnippet}`,
        href: `/event-packets/${packetId}`,
      });
    } catch {
      // Packet save still succeeds if notifications fail.
    }
  }

  if (status === "completed" && !packet.event_report_id) {
    const { data: report, error: reportError } = await supabase
      .from("event_reports")
      .insert({
        reporter_id: packet.assignee_id,
        event_date: payload.event_date,
        client_name: payload.client_name,
        venue: payload.venue_raw,
        event_type: payload.event_type,
        event_type_other: eventTypeOther,
        hours_worked: payload.hours_worked,
        equipment_notes: payload.equipment_notes,
        memorable_moment: payload.memorable_moment,
        issues: payload.issues,
        client_feedback: payload.client_feedback,
        rating: payload.rating,
        follow_up_needed: payload.follow_up_needed,
        follow_up_notes: payload.follow_up_notes,
      })
      .select("id")
      .single();

    if (!reportError && report?.id) {
      await supabase
        .from("event_packets")
        .update({ event_report_id: report.id })
        .eq("id", packetId);
    }
  }

  // Auto-queue marketing drafts when completed with client social consent.
  if (
    status === "completed" &&
    payload.social_consent &&
    (packet.status !== "completed" || !packet.social_consent)
  ) {
    try {
      await queuePacketDrafts({
        supabase,
        packetId,
        userId: user.id,
        scheduleInHours: 24,
      });
    } catch {
      // Packet save still succeeds; marketers can queue manually.
    }
  }

  revalidatePacketPaths(packetId);
  return { error: null };
}

/**
 * Re-apply Event details & recap onto every photo/video already on the packet
 * (tags, Library folder path, storage object filename). Safe to run anytime.
 */
export async function syncPacketMediaFromRecapAction(
  packetId: string,
): Promise<{
  error: string | null;
  updated?: number;
  moved?: number;
  message?: string;
}> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }

  const { data: packet, error: fetchError } = await supabase
    .from("event_packets")
    .select(
      "id, assignee_id, venue_id, venue_raw, client_name, event_type, event_type_other, dj_name, event_date, venue:venues!event_packets_venue_id_fkey(name)",
    )
    .eq("id", packetId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!packet) return { error: "Packet not found." };

  const isAdmin = profile.role === "admin";
  if (packet.assignee_id !== user.id && !isAdmin) {
    return { error: "You can only sync media on your own event packets." };
  }

  const venueName =
    (packet.venue as { name?: string } | null)?.name ||
    String(packet.venue_raw ?? "");

  const { syncPacketMediaFromRecap } = await import(
    "@/lib/event-packets/sync-media-from-recap"
  );
  const result = await syncPacketMediaFromRecap({
    supabase,
    packetId,
    venueId: (packet.venue_id as string | null) ?? null,
    clientName: String(packet.client_name ?? ""),
    venueRaw: venueName,
    eventType: String(packet.event_type ?? "Other"),
    eventTypeOther: String(
      (packet as { event_type_other?: string }).event_type_other ?? "",
    ),
    djName: String(packet.dj_name ?? ""),
    eventDate: String(packet.event_date ?? ""),
  });

  if (result.errors.length && result.updated === 0 && !result.changed) {
    return { error: result.errors[0] ?? "Could not sync media tags." };
  }

  // Best-effort Drive re-upload into the corrected folder/name.
  if (await isDriveConfigured()) {
    try {
      await syncPacketMediaToDrive(packetId, { force: true });
    } catch {
      // Tag sync still succeeded.
    }
  }

  revalidatePacketPaths(packetId);
  revalidatePath("/submit-event-photos");

  const renameNote =
    result.moved > 0
      ? ` (${result.moved} renamed in storage)`
      : result.errors.length
        ? " (some storage renames were skipped — tags/folders still updated)"
        : "";

  return {
    error: null,
    updated: result.updated,
    moved: result.moved,
    message: `Synced ${result.updated} file${
      result.updated === 1 ? "" : "s"
    }${renameNote} from Event details & recap.`,
  };
}

export async function insertPacketMediaAction(input: {
  packet_id: string;
  storage_path: string;
  file_name: string;
  original_file_name: string;
  media_type: string;
  sequence_number: number;
  dj_name: string;
  location_name: string;
  event_date: string;
  client_name: string;
  event_type: string;
  storage_provider?: "supabase" | "bunny";
}): Promise<{ error: string | null; id?: string; file_name?: string }> {
  const { supabase, user, profile, error } = await requireUser();
  if (error || !user || !profile) {
    return { error: error ?? "You must be signed in." };
  }

  const { data: packet } = await supabase
    .from("event_packets")
    .select("id, assignee_id, venue_id, folder_name")
    .eq("id", input.packet_id)
    .maybeSingle();

  if (!packet) return { error: "Packet not found." };
  if (packet.assignee_id !== user.id && profile.role !== "admin") {
    return { error: "You can only upload to your own packets." };
  }
  if (!input.storage_path.startsWith(`${user.id}/`)) {
    return { error: "Invalid storage path." };
  }

  const locationName = sanitizeNamePart(input.location_name || "Venue");
  const djName = sanitizeNamePart(input.dj_name || "Staff");
  const eventDate = input.event_date || new Date().toISOString().slice(0, 10);
  const sequence = Math.max(1, input.sequence_number);
  // Prefer the uploaded/converted file name (e.g. .jpg after HEIC convert),
  // not the iPhone original (.heic), so DB names match storage bytes.
  const fileName = buildMediaFileName({
    locationName,
    djName,
    eventDate,
    sequence,
    extension: extensionFromFileName(input.file_name || input.original_file_name),
  });
  const eventFolder = buildEventFolderName({
    locationName,
    djName,
    eventDate,
  });
  const folderPath = buildFolderPath({
    venueFolderSlug: folderSlugFromName(locationName),
    eventFolderName: eventFolder,
  });

  const { data, error: insertError } = await supabase
    .from("event_media")
    .insert({
      uploader_id: user.id,
      packet_id: packet.id,
      venue_id: packet.venue_id,
      event_name: eventFolder,
      event_date: eventDate,
      storage_path: input.storage_path,
      storage_provider: input.storage_provider === "bunny" ? "bunny" : "supabase",
      file_name: fileName,
      original_file_name: input.original_file_name || input.file_name,
      media_type: input.media_type,
      sequence_number: sequence,
      dj_name: djName,
      location_name: locationName,
      client_name: input.client_name.trim(),
      event_type: input.event_type.trim(),
      folder_path: folderPath,
    })
    .select("id, file_name")
    .single();

  if (insertError) return { error: insertError.message };

  if (packet.assignee_id === user.id) {
    await supabase
      .from("event_packets")
      .update({
        status: "in_progress",
        dj_name: djName,
        folder_name: eventFolder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", packet.id)
      .neq("status", "completed");
  }

  // Best-effort Drive mirror for newly uploaded files (skips already synced).
  if (await isDriveConfigured()) {
    try {
      await syncPacketMediaToDrive(packet.id);
    } catch {
      // Upload still succeeded; admin can retry Backup to Drive.
    }
  }

  revalidatePacketPaths(packet.id);
  revalidatePath("/submit-event-photos");
  return { error: null, id: data.id, file_name: data.file_name };
}

export async function nextPacketMediaSequenceAction(
  packetId: string,
): Promise<{ sequence: number; error: string | null }> {
  const { supabase, user, error } = await requireUser();
  if (error || !user) return { sequence: 1, error: error ?? "You must be signed in." };

  const { data } = await supabase
    .from("event_media")
    .select("sequence_number")
    .eq("packet_id", packetId)
    .order("sequence_number", { ascending: false })
    .limit(1);

  const max = data?.[0]?.sequence_number;
  return {
    sequence: typeof max === "number" && max > 0 ? max + 1 : 1,
    error: null,
  };
}
