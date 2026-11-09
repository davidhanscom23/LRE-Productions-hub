import { MyWeekPageClient } from "@/components/my-week/my-week-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCachedGenericIcalEvents } from "@/lib/calendar/events";
import { eventsInNextDays } from "@/lib/calendar/format";
import { getSharedWorkIcalUrl } from "@/lib/calendar/settings";
import { firstNameFrom } from "@/lib/home/greeting";
import { getOrAssignDailyQuote } from "@/lib/my-week/daily-quote";
import { normalizeHexColor, type StaffColorEntry } from "@/lib/people/color";
import { createClient } from "@/lib/supabase/server";
import type { HoneyBookTask } from "@/lib/types/honeybook-tasks";
import type { Task } from "@/lib/types/tasks";

export default async function MyWeekPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";

  const firstName = firstNameFrom(profile?.full_name, profile?.email ?? "");
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dailyQuote = profile
    ? await getOrAssignDailyQuote(profile.id)
    : null;

  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, color, is_active")
    .eq("is_active", true);

  const staffColors: StaffColorEntry[] = (staffRows ?? []).map((row) => ({
    id: row.id as string,
    full_name: (row.full_name as string) ?? "",
    email: (row.email as string) ?? "",
    color: normalizeHexColor((row as { color?: unknown }).color),
    is_active: Boolean(row.is_active),
  }));

  const icalUrl = await getSharedWorkIcalUrl();

  let events: Awaited<ReturnType<typeof getCachedGenericIcalEvents>> = [];
  let calendarError: string | null = null;

  if (icalUrl) {
    try {
      const all = await getCachedGenericIcalEvents(icalUrl, "work");
      events = eventsInNextDays(all, 7);
    } catch (error) {
      calendarError =
        error instanceof Error
          ? error.message
          : "Unknown error loading the calendar feed.";
    }
  }

  const { data: taskRows } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  const tasks = ((taskRows ?? []) as Task[]).map((row) => ({
    ...row,
    due_date: row.due_date ?? null,
  }));

  let honeyBookTasks: HoneyBookTask[] = [];
  if (profile) {
    const { data: hbRows, error: hbError } = await supabase
      .from("honeybook_tasks")
      .select("*")
      .eq("assignee_profile_id", profile.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (!hbError && hbRows) {
      honeyBookTasks = (hbRows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        external_id: r.external_id ? String(r.external_id) : null,
        title: String(r.title ?? ""),
        due_date: (r.due_date as string) ?? null,
        status: r.status === "done" ? "done" : "open",
        assignee_email: String(r.assignee_email ?? ""),
        assignee_name: String(r.assignee_name ?? ""),
        assignee_profile_id: r.assignee_profile_id
          ? String(r.assignee_profile_id)
          : null,
        project_id: r.project_id ? String(r.project_id) : null,
        client_id: r.client_id ? String(r.client_id) : null,
        project_name: String(r.project_name ?? ""),
        notes: String(r.notes ?? ""),
        source_event: String(r.source_event ?? ""),
        hub_done: Boolean(r.hub_done),
        hub_done_at: (r.hub_done_at as string) ?? null,
        created_at: String(r.created_at ?? ""),
        updated_at: String(r.updated_at ?? ""),
      }));
    }
  }

  return (
    <MyWeekPageClient
      firstName={firstName}
      todayLabel={todayLabel}
      dailyQuote={
        dailyQuote
          ? {
              text: dailyQuote.text,
              author: dailyQuote.author,
            }
          : null
      }
      events={events}
      hasCalendarFeed={Boolean(icalUrl)}
      isAdmin={Boolean(isAdmin)}
      calendarError={calendarError}
      tasks={tasks}
      honeyBookTasks={honeyBookTasks}
      staffColors={staffColors}
    />
  );
}
