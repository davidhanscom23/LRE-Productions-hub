import { extractExternalEventId } from "@/lib/calendar/external-event-id";
import { type CalendarEvent } from "@/lib/calendar/events";
import {
  DEFAULT_PACKET_LOOKBACK_DAYS,
  isManualPacketEligible,
  isPacketEligible,
} from "@/lib/event-packets/eligibility";
import { matchAssignedStaffProfiles } from "@/lib/event-packets/match-staff";
import { buildEventFolderName } from "@/lib/event-packets/naming";
import {
  ensureVenueForName,
  listVenuesWithAliases,
  resolveVenueFromList,
} from "@/lib/event-packets/venues";
import { insertNotifications } from "@/lib/notifications/notify";
import { EVENT_TYPES, type EventType } from "@/lib/types/event-reports";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncPacketsResult = {
  created: number;
  updated: number;
  skipped: number;
  unmatchedStaff: string[];
  error: string | null;
};

export { isManualPacketEligible, isPacketEligible };

function eventDateFromCalendar(event: CalendarEvent): string {
  // Prefer local calendar date from ISO start
  return event.start.slice(0, 10);
}

function mapEventType(raw: string | null): EventType {
  if (!raw) return "Other";
  const trimmed = raw.trim();
  const exact = EVENT_TYPES.find(
    (type) => type.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return exact;
  if (/wedding/i.test(trimmed)) return "Wedding";
  if (/corporate|company/i.test(trimmed)) return "Corporate";
  if (/birthday/i.test(trimmed)) return "Birthday";
  if (/anniversary/i.test(trimmed)) return "Anniversary";
  if (/school|prom|homecoming|dance/i.test(trimmed)) return "School Dance";
  return "Other";
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
};

export type LaunchablePastEvent = {
  uid: string;
  eventDate: string;
  clientName: string;
  venue: string;
  eventType: string;
  assignedStaff: string;
};

/** Create or return an existing packet for one calendar event + assignee. */
export async function createPacketFromCalendarEvent(options: {
  supabase: SupabaseClient;
  event: CalendarEvent;
  assignee: ProfileRow;
  canCreateVenues: boolean;
  /**
   * Archive / optional packets (website-review backfill). Never overdue and
   * excluded from For You / packet_24h.
   */
  completionOptional?: boolean;
}): Promise<{ packetId: string | null; created: boolean; error: string | null }> {
  const {
    supabase,
    event,
    assignee,
    canCreateVenues,
    completionOptional = false,
  } = options;

  if (!isManualPacketEligible(event)) {
    return {
      packetId: null,
      created: false,
      error: "Only past or today events can become packets.",
    };
  }

  const { data: existing } = await supabase
    .from("event_packets")
    .select("id, completion_optional")
    .eq("calendar_uid", event.uid)
    .eq("assignee_id", assignee.id)
    .maybeSingle();

  if (existing?.id) {
    // Upgrade a normal packet to optional if the review bridge re-touches it.
    if (
      completionOptional &&
      existing.completion_optional === false
    ) {
      await supabase
        .from("event_packets")
        .update({
          completion_optional: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return { packetId: String(existing.id), created: false, error: null };
  }

  let venues = await listVenuesWithAliases(supabase);
  const eventDate = eventDateFromCalendar(event);
  const venueRaw = event.venue?.trim() || "Unknown venue";
  let venue = resolveVenueFromList(venueRaw, venues);
  if (!venue && canCreateVenues) {
    venue = await ensureVenueForName(venueRaw, supabase);
    venues = await listVenuesWithAliases(supabase);
  }

  const locationName = venue?.name ?? venueRaw;
  const eventType = mapEventType(event.eventType);
  const djName = assignee.full_name?.trim() || assignee.email;
  const folderName = buildEventFolderName({
    locationName,
    djName,
    eventDate,
  });

  const { data: inserted, error } = await supabase
    .from("event_packets")
    .insert({
      calendar_uid: event.uid,
      assignee_id: assignee.id,
      event_date: eventDate,
      client_name: event.clientName?.trim() || event.title?.trim() || "",
      venue_raw: venueRaw,
      venue_id: venue?.id ?? null,
      event_type: eventType,
      dj_name: djName,
      folder_name: folderName,
      status: "needs_completion",
      completion_optional: completionOptional,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return {
      packetId: null,
      created: false,
      error: error?.message ?? "Could not create packet.",
    };
  }

  return { packetId: String(inserted.id), created: true, error: null };
}

export async function syncPacketsFromEvents(options: {
  supabase: SupabaseClient;
  events: CalendarEvent[];
  /** If set, only create/update packets for this assignee. */
  onlyAssigneeId?: string;
  canCreateVenues: boolean;
  /** Override auto-sync lookback (days ago through today). */
  lookbackDays?: number;
  /**
   * When set, only sync these planner event ids (digits). Used to bridge
   * website reviews → packets for events still on the calendar feed.
   */
  onlyEventIds?: Set<string>;
}): Promise<SyncPacketsResult> {
  const {
    supabase,
    events,
    onlyAssigneeId,
    canCreateVenues,
    lookbackDays = DEFAULT_PACKET_LOOKBACK_DAYS,
    onlyEventIds,
  } = options;
  const eligible = events.filter((event) => {
    if (!isPacketEligible(event, new Date(), lookbackDays)) return false;
    if (!onlyEventIds || onlyEventIds.size === 0) return true;
    const eventId = extractExternalEventId(event.uid);
    return Boolean(eventId && onlyEventIds.has(eventId));
  });

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("is_active", true);

  const profiles = (profileRows ?? []) as ProfileRow[];
  let venues = await listVenuesWithAliases(supabase);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const unmatched = new Set<string>();
  const assignmentNotices: {
    userId: string;
    title: string;
    body: string;
    href: string;
  }[] = [];

  for (const event of eligible) {
    const byId = new Map<string, ProfileRow>();
    for (const id of event.assignedProfileIds ?? []) {
      const person = profiles.find((p) => p.id === id);
      if (person) byId.set(person.id, person);
    }
    for (const person of matchAssignedStaffProfiles(
      event.assignedStaff,
      profiles,
    )) {
      byId.set(person.id, {
        id: person.id,
        full_name: person.full_name,
        email: person.email,
        is_active: person.is_active !== false,
      });
    }
    const matched = Array.from(byId.values());
    if (matched.length === 0) {
      if (event.assignedStaff?.trim()) {
        unmatched.add(event.assignedStaff.trim());
      }
      skipped += 1;
      continue;
    }

    const targets = onlyAssigneeId
      ? matched.filter((person) => person.id === onlyAssigneeId)
      : matched;

    if (targets.length === 0) {
      skipped += 1;
      continue;
    }

    const eventDate = eventDateFromCalendar(event);
    const venueRaw = event.venue?.trim() || "Unknown venue";
    let venue = resolveVenueFromList(venueRaw, venues);
    if (!venue && canCreateVenues) {
      venue = await ensureVenueForName(venueRaw, supabase);
      venues = await listVenuesWithAliases(supabase);
    }

    const locationName = venue?.name ?? venueRaw;
    const eventType = mapEventType(event.eventType);

    for (const person of targets) {
      const djName = person.full_name?.trim() || person.email;
      const folderName = buildEventFolderName({
        locationName,
        djName,
        eventDate,
      });

      const row = {
        calendar_uid: event.uid,
        assignee_id: person.id,
        event_date: eventDate,
        client_name: event.clientName?.trim() || event.title?.trim() || "",
        venue_raw: venueRaw,
        venue_id: venue?.id ?? null,
        event_type: eventType,
        dj_name: djName,
        folder_name: folderName,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("event_packets")
        .select("id, status")
        .eq("calendar_uid", event.uid)
        .eq("assignee_id", person.id)
        .maybeSingle();

      if (existing?.id) {
        // Don't overwrite completion fields — only refresh calendar-derived tags.
        if (existing.status === "completed") {
          skipped += 1;
          continue;
        }
        const { error } = await supabase
          .from("event_packets")
          .update({
            event_date: row.event_date,
            client_name: row.client_name,
            venue_raw: row.venue_raw,
            venue_id: row.venue_id,
            event_type: row.event_type,
            dj_name: row.dj_name,
            folder_name: row.folder_name,
            updated_at: row.updated_at,
          })
          .eq("id", existing.id);
        if (error) {
          skipped += 1;
          continue;
        }
        updated += 1;
      } else {
        const { data: inserted, error } = await supabase
          .from("event_packets")
          .insert({
            ...row,
            status: "needs_completion",
          })
          .select("id")
          .single();
        if (error || !inserted?.id) {
          skipped += 1;
          continue;
        }
        created += 1;
        assignmentNotices.push({
          userId: person.id,
          title: "New Event Packet assigned",
          body: `${row.client_name || "Event"} · ${row.venue_raw} · ${row.event_date} needs wrap-up.`,
          href: `/event-packets/${inserted.id}`,
        });
      }
    }
  }

  if (assignmentNotices.length) {
    // Dedupe forever by href so re-sync after a delete/recreate doesn't spam.
    const hrefs = assignmentNotices.map((row) => row.href);
    const { data: existingNotices } = await supabase
      .from("hub_notifications")
      .select("href")
      .eq("kind", "packet_assigned")
      .in("href", hrefs);

    const already = new Set(
      (existingNotices ?? []).map((row) => String(row.href ?? "")),
    );

    await insertNotifications(
      supabase,
      assignmentNotices
        .filter((row) => !already.has(row.href))
        .map((row) => ({
          userId: row.userId,
          kind: "packet_assigned",
          title: row.title,
          body: row.body,
          href: row.href,
        })),
    );
  }

  return {
    created,
    updated,
    skipped,
    unmatchedStaff: Array.from(unmatched).sort(),
    error: null,
  };
}
