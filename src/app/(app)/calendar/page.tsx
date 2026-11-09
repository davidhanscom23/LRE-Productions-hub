import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  getCachedGenericIcalEvents,
  type CalendarEvent,
} from "@/lib/calendar/events";
import {
  honeybookProjectsToEvents,
  mergeHoneybookIcalWithCrm,
} from "@/lib/calendar/honeybook";
import {
  getSharedWorkIcalUrl,
  isHoneybookIcalConfigured,
  isSharedCalendarConfigured,
} from "@/lib/calendar/settings";
import { normalizeHexColor, type StaffColorEntry } from "@/lib/people/color";
import { teamTimeOffToEvents } from "@/lib/calendar/time-off";
import type { TeamTimeOff } from "@/lib/types/time-off";
import {
  normalizeAvailableDays,
  type StaffAvailabilityEntry,
} from "@/lib/calendar/availability";
import {
  applyHubAssignmentsToEvents,
  mergeBoardAssignees,
  type BoardAssigneeRow,
} from "@/lib/calendar/assignments";
import { normalizeDepartments } from "@/lib/types/database";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { HoneyBookClient, HoneyBookProject } from "@/lib/types/honeybook";

async function loadStaffColors(): Promise<StaffColorEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, color, is_active")
    .eq("is_active", true);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    full_name: (row.full_name as string) ?? "",
    email: (row.email as string) ?? "",
    color: normalizeHexColor((row as { color?: unknown }).color),
    is_active: Boolean(row.is_active),
  }));
}

/** Shared HoneyBook→Google (or company) iCal for every calendar user. */
async function loadSharedWorkFeed(): Promise<{
  configured: boolean;
  events: CalendarEvent[];
  fetchError: string | null;
  honeybookConfigured: boolean;
}> {
  const honeybookConfigured = await isHoneybookIcalConfigured();
  const workUrl = await getSharedWorkIcalUrl();

  if (!workUrl) {
    return {
      configured: false,
      events: [],
      fetchError: null,
      honeybookConfigured,
    };
  }

  try {
    // Prefer honeybook source when the HoneyBook setting is set; otherwise work.
    const source = honeybookConfigured ? "honeybook" : "work";
    const events = await getCachedGenericIcalEvents(workUrl, source);
    return {
      configured: true,
      events,
      fetchError: null,
      honeybookConfigured,
    };
  } catch (error) {
    return {
      configured: true,
      events: [],
      fetchError:
        error instanceof Error
          ? error.message
          : "Couldn’t load the work calendar.",
      honeybookConfigured,
    };
  }
}

/** Approved staff time off rows. Never blocks/throws. */
async function loadTimeOff(): Promise<TeamTimeOff[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("list_team_time_off", {});
    return (data ?? []) as TeamTimeOff[];
  } catch {
    return [];
  }
}

/**
 * CRM project-date overlay when no live HoneyBook iCal is configured.
 */
async function loadHoneyBookProjects() {
  try {
    const supabase = isServiceRoleConfigured()
      ? createServiceClient()
      : await createClient();
    // Cards merged into another (migration 175) must not show twice. Fall back to the old
    // column list so the calendar still loads before that migration is applied.
    let projectRows: Record<string, unknown>[] | null;
    let error: { message: string } | null;
    ({ data: projectRows, error } = await supabase
      .from("honeybook_projects")
      .select(
        "id, name, stage, project_type, project_date, location, client_id, merged_into",
      )
      .not("project_date", "is", null)
      .is("merged_into", null));
    if (error) {
      ({ data: projectRows, error } = await supabase
        .from("honeybook_projects")
        .select(
          "id, name, stage, project_type, project_date, location, client_id",
        )
        .not("project_date", "is", null));
    }
    if (error || !projectRows?.length) return [];

    const clientIds = Array.from(
      new Set(
        (projectRows as HoneyBookProject[])
          .map((p) => p.client_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const clientById = new Map<
      string,
      Pick<HoneyBookClient, "id" | "full_name" | "email" | "phone">
    >();
    if (clientIds.length) {
      const { data: clients } = await supabase
        .from("honeybook_clients")
        .select("id, full_name, email, phone")
        .in("id", clientIds);
      for (const c of (clients ?? []) as Pick<
        HoneyBookClient,
        "id" | "full_name" | "email" | "phone"
      >[]) {
        clientById.set(c.id, c);
      }
    }

    return (projectRows as HoneyBookProject[]).map((p) => {
      const c = p.client_id ? clientById.get(p.client_id) : undefined;
      return {
        id: p.id,
        name: p.name,
        stage: p.stage,
        project_type: p.project_type,
        project_date: p.project_date,
        location: p.location,
        client_id: p.client_id,
        client_name: c?.full_name ?? null,
        client_email: c?.email ?? null,
        client_phone: c?.phone ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** Active staff with departments + weekly availability (for the availability panel). */
async function loadStaffAvailability(): Promise<StaffAvailabilityEntry[]> {
  try {
    const supabase = await createClient();
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name, departments, role")
      .eq("is_active", true);
    const staff = (people ?? []).filter((p) => p.role !== "guest");
    const ids = staff.map((s) => s.id as string);
    const { data: avail } = ids.length
      ? await supabase
          .from("staff_availability")
          .select("user_id, available_days")
          .in("user_id", ids)
      : { data: [] as { user_id: string; available_days: unknown }[] };
    const availByUser = new Map(
      (avail ?? []).map((a) => [
        a.user_id as string,
        normalizeAvailableDays(a.available_days),
      ]),
    );
    return staff
      .filter((s) => (s.full_name as string)?.trim())
      .map((s) => ({
        id: s.id as string,
        name: s.full_name as string,
        departments: normalizeDepartments(
          (s as { departments?: unknown }).departments,
        ),
        availableDays: availByUser.get(s.id as string) ?? normalizeAvailableDays([]),
      }));
  } catch {
    return [];
  }
}

/** Hub staff assignments keyed by calendar event uid. */
async function loadEventAssignments(): Promise<{
  byUid: Map<string, string[]>;
  nameById: Map<string, string>;
}> {
  const empty = {
    byUid: new Map<string, string[]>(),
    nameById: new Map<string, string>(),
  };
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("calendar_event_assignments")
      .select("event_uid, profile_id");
    if (error || !rows?.length) return empty;

    const byUid = new Map<string, string[]>();
    const profileIds = new Set<string>();
    for (const row of rows) {
      const uid = String(row.event_uid ?? "");
      const pid = String(row.profile_id ?? "");
      if (!uid || !pid) continue;
      profileIds.add(pid);
      const list = byUid.get(uid) ?? [];
      list.push(pid);
      byUid.set(uid, list);
    }

    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(profileIds));
    const nameById = new Map(
      (people ?? []).map((p) => [
        p.id as string,
        ((p.full_name as string) ?? "").trim(),
      ]),
    );
    return { byUid, nameById };
  } catch {
    return empty;
  }
}

/** HoneyBook board assignees for the given CRM cards; also fills in missing names. */
async function loadBoardAssignees(
  projectIds: string[],
  nameById: Map<string, string>,
): Promise<BoardAssigneeRow[]> {
  if (!projectIds.length) return [];
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("honeybook_project_assignees")
      .select("project_id, profile_id")
      .in("project_id", Array.from(new Set(projectIds)));
    if (error || !rows?.length) return [];
    const missing = Array.from(
      new Set(
        rows
          .map((r) => String(r.profile_id))
          .filter((id) => !nameById.has(id)),
      ),
    );
    if (missing.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", missing);
      for (const p of people ?? []) {
        nameById.set(p.id as string, ((p.full_name as string) ?? "").trim());
      }
    }
    return rows.map((r) => ({
      project_id: String(r.project_id),
      profile_id: String(r.profile_id),
    }));
  } catch {
    return [];
  }
}

export default async function CalendarPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const canAssignStaff =
    profile?.role === "admin" || profile?.role === "trainer";

  const [
    staffColors,
    feed,
    timeOffRows,
    staffAvailability,
    sharedConfigured,
    assignments,
  ] = await Promise.all([
    loadStaffColors(),
    loadSharedWorkFeed(),
    loadTimeOff(),
    loadStaffAvailability(),
    isSharedCalendarConfigured(),
    loadEventAssignments(),
  ]);

  // Always load CRM projects: enrich iCal events (status/client/type) and
  // keep unmatched dated projects as overlays.
  const hbFromCrm = await loadHoneyBookProjects();
  const honeybookEvents = feed.honeybookConfigured
    ? mergeHoneybookIcalWithCrm(feed.events, hbFromCrm).events
    : [
        ...feed.events,
        ...honeybookProjectsToEvents(hbFromCrm),
      ];

  const sortedEvents = [
    ...honeybookEvents,
    ...teamTimeOffToEvents(timeOffRows),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Staff assigned on the HoneyBook board (lead + support) show on the calendar too.
  const board = await loadBoardAssignees(
    sortedEvents
      .map((e) => e.crmProjectId)
      .filter((id): id is string => Boolean(id)),
    assignments.nameById,
  );

  const events = applyHubAssignmentsToEvents(
    sortedEvents,
    mergeBoardAssignees(sortedEvents, board, assignments.byUid),
    assignments.nameById,
  );

  return (
    <CalendarPageClient
      configured={
        sharedConfigured ||
        feed.events.length > 0 ||
        hbFromCrm.length > 0
      }
      events={events}
      fetchError={feed.fetchError}
      isAdmin={Boolean(isAdmin)}
      canAssignStaff={Boolean(canAssignStaff)}
      staffColors={staffColors}
      staff={staffAvailability}
      teamTimeOff={timeOffRows}
      honeybookIcalConfigured={feed.honeybookConfigured}
    />
  );
}
