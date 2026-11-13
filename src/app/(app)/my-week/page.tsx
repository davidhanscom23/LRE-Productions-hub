import { MyWeekPageClient } from "@/components/my-week/my-week-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCachedGenericIcalEvents } from "@/lib/calendar/events";
import { eventsInNextDays } from "@/lib/calendar/format";
import { getSharedWorkIcalUrl } from "@/lib/calendar/settings";
import { firstNameFrom } from "@/lib/home/greeting";
import { getOrAssignDailyQuote } from "@/lib/my-week/daily-quote";
import { normalizeHexColor, type StaffColorEntry } from "@/lib/people/color";
import { createClient } from "@/lib/supabase/server";
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
      staffColors={staffColors}
    />
  );
}
