import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  COMPANY_ICAL_SETTING_KEY,
  fetchDjepIcalPartition,
  type CalendarEvent,
} from "@/lib/calendar/events";
import {
  matchAssignedStaffProfiles,
  type MatchableProfile,
} from "@/lib/event-packets/match-staff";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";

type ServiceClient = ReturnType<typeof createServiceClient>;

async function companyIcalUrl(supabase: ServiceClient): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", COMPANY_ICAL_SETTING_KEY)
    .maybeSingle();
  const v = ((data?.value as string) ?? "").trim();
  return v || null;
}

function toIcsEvent(e: CalendarEvent): IcsEvent {
  const desc = [e.eventType, e.clientName, e.venue].filter(Boolean).join(" · ");
  return {
    uid: e.uid,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    location: e.venue,
    description: desc || null,
    url: e.eventUrl,
  };
}

/** Build the read-only iCal document for the staff member owning this token. */
export async function getStaffFeedIcsByToken(
  token: string,
): Promise<string | null> {
  if (!token || token.length < 12) return null;
  const supabase = createServiceClient();

  const { data: me } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("calendar_feed_token", token)
    .maybeSingle();
  if (!me) return null;

  const calName = `${me.full_name || "My"} — LRE Productions`;
  const url = await companyIcalUrl(supabase);
  if (!url) return buildIcs([], calName);

  const { workEvents } = await fetchDjepIcalPartition(url);

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active");
  const profiles: MatchableProfile[] = (profilesData ?? []) as MatchableProfile[];

  const mine = workEvents.filter((e) =>
    matchAssignedStaffProfiles(e.assignedStaff, profiles).some(
      (p) => p.id === me.id,
    ),
  );

  return buildIcs(mine.map(toIcsEvent), calName);
}

/** The current user's feed token (created by the migration default). */
export async function getMyFeedToken(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("calendar_feed_token")
    .eq("id", userId)
    .maybeSingle();
  return (data?.calendar_feed_token as string) ?? null;
}
