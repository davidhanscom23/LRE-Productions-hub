import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { insertNotifications, notifyAdmins } from "@/lib/notifications/notify";
import { getPmiJoinInfo } from "@/lib/zoom/client";

export type ActiveHuddle = {
  id: string;
  joinUrl: string;
  topic: string | null;
  startedAt: string;
  endsAt: string;
};

export type ScheduledHuddle = {
  id: string;
  joinUrl: string;
  topic: string | null;
  scheduledAt: string;
};

type StartResult =
  | { id: string; joinUrl: string; startUrl: string }
  | { error: string };

const HUDDLE_WINDOW_MIN = 120; // a huddle stays "live" for up to 2h unless ended
const SCHEDULE_GRACE_MIN = 120; // a past-due scheduled huddle stays startable for 2h
const APP_TZ = "America/New_York"; // LRE Productions operates on Eastern time

/** Human-readable local (Eastern) time for notifications, e.g. "Fri, Aug 8, 3:00 PM". */
function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** The current live huddle (actually started, not ended, still in window). */
export async function getActiveHuddle(): Promise<ActiveHuddle | null> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("zoom_huddles")
    .select("id, join_url, topic, started_at, ends_at")
    .is("ended_at", null)
    .not("started_at", "is", null)
    .gt("ends_at", nowIso)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    joinUrl: data.join_url as string,
    topic: (data.topic as string) ?? null,
    startedAt: data.started_at as string,
    endsAt: data.ends_at as string,
  };
}

/** The next pending scheduled huddle (not yet started, not cancelled). */
export async function getScheduledHuddle(): Promise<ScheduledHuddle | null> {
  const supabase = createServiceClient();
  const graceIso = new Date(Date.now() - SCHEDULE_GRACE_MIN * 60_000).toISOString();
  const { data } = await supabase
    .from("zoom_huddles")
    .select("id, join_url, topic, scheduled_at")
    .is("ended_at", null)
    .is("started_at", null)
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", graceIso)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    joinUrl: data.join_url as string,
    topic: (data.topic as string) ?? null,
    scheduledAt: data.scheduled_at as string,
  };
}

/** Broadcast the live join link to every active staff member (except the starter). */
async function broadcastLive(
  supabase: ReturnType<typeof createServiceClient>,
  joinUrl: string,
  startedBy: string,
): Promise<void> {
  const { data: staff } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);
  const rows = (staff ?? [])
    .filter((p) => p.id !== startedBy)
    .map((p) => ({
      userId: p.id as string,
      kind: "huddle",
      title: "🔴 Team huddle is live",
      body: "Tap to jump on Zoom now.",
      href: joinUrl,
    }));
  await insertNotifications(supabase, rows);
}

/** Start a huddle right now: pull the PMI link, record it, broadcast to staff. */
export async function startHuddle(startedBy: string): Promise<StartResult> {
  let pmi;
  try {
    pmi = await getPmiJoinInfo();
  } catch {
    return { error: "Could not reach Zoom. Check the Zoom app credentials." };
  }
  if (!pmi.joinUrl) return { error: "No Zoom personal room link found." };

  const supabase = createServiceClient();
  const now = new Date();
  const endsAt = new Date(now.getTime() + HUDDLE_WINDOW_MIN * 60_000).toISOString();

  // Only one live/pending huddle at a time.
  await supabase
    .from("zoom_huddles")
    .update({ ended_at: now.toISOString() })
    .is("ended_at", null);

  const { data, error } = await supabase
    .from("zoom_huddles")
    .insert({
      join_url: pmi.joinUrl,
      topic: pmi.topic,
      started_by: startedBy,
      scheduled_at: null,
      started_at: now.toISOString(),
      ends_at: endsAt,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not start huddle." };

  await broadcastLive(supabase, pmi.joinUrl, startedBy);
  return { id: data.id as string, joinUrl: pmi.joinUrl, startUrl: pmi.startUrl };
}

/** Schedule a huddle for a future time (does not go live until started). */
export async function scheduleHuddle(
  createdBy: string,
  scheduledAtIso: string,
  topic?: string,
  opts?: { force?: boolean },
): Promise<
  | { id: string; scheduledAt: string; topic: string | null }
  | {
      error: string;
      code?: "calendar_conflict";
      conflicts?: import("@/lib/huddle/calendar-conflict").HuddleCalendarConflict[];
    }
> {
  const when = new Date(scheduledAtIso);
  if (Number.isNaN(when.getTime())) return { error: "Invalid date/time." };
  if (when.getTime() < Date.now() + 60_000) {
    return { error: "Pick a time at least a minute from now." };
  }

  if (!opts?.force) {
    try {
      const { getSharedWorkIcalUrl } = await import("@/lib/calendar/settings");
      const { getCachedGenericIcalEvents } = await import(
        "@/lib/calendar/events"
      );
      const { findHuddleCalendarConflicts } = await import(
        "@/lib/huddle/calendar-conflict"
      );
      const icalUrl = await getSharedWorkIcalUrl();
      if (icalUrl) {
        const events = await getCachedGenericIcalEvents(icalUrl, "work");
        const conflicts = findHuddleCalendarConflicts(
          when.toISOString(),
          events,
        );
        if (conflicts.length > 0) {
          return {
            error:
              "That time overlaps calendar events. Confirm to schedule anyway, or pick another time.",
            code: "calendar_conflict",
            conflicts: conflicts.slice(0, 8),
          };
        }
      }
    } catch {
      // Calendar feed unavailable — allow scheduling rather than blocking.
    }
  }

  let pmi;
  try {
    pmi = await getPmiJoinInfo();
  } catch {
    return { error: "Could not reach Zoom. Check the Zoom app credentials." };
  }
  if (!pmi.joinUrl) return { error: "No Zoom personal room link found." };

  const supabase = createServiceClient();
  // Replace any existing pending (not-yet-live) scheduled huddle.
  await supabase
    .from("zoom_huddles")
    .update({ ended_at: new Date().toISOString() })
    .is("ended_at", null)
    .is("started_at", null);

  const cleanTopic = topic?.trim() || pmi.topic || null;
  const { data, error } = await supabase
    .from("zoom_huddles")
    .insert({
      join_url: pmi.joinUrl,
      topic: cleanTopic,
      started_by: createdBy,
      scheduled_at: when.toISOString(),
      started_at: null,
      ends_at: null,
    })
    .select("id, scheduled_at, topic")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not schedule huddle." };

  // Notify all active staff right away so they see it on login (alongside the
  // home banner). The join link comes later, when the huddle actually starts.
  const { data: staff } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);
  const suffix = cleanTopic ? ` — ${cleanTopic}` : "";
  const whenLabel = formatWhen(when.toISOString());
  const rows = (staff ?? [])
    .filter((p) => p.id !== createdBy)
    .map((p) => ({
      userId: p.id as string,
      kind: "huddle",
      title: `📅 Team huddle scheduled${suffix}`,
      body: `${whenLabel}. You'll get the join link when it starts.`,
      href: "/",
    }));
  await insertNotifications(supabase, rows);

  return {
    id: data.id as string,
    scheduledAt: data.scheduled_at as string,
    topic: (data.topic as string) ?? null,
  };
}

/** Promote a scheduled huddle to live now (admin clicked "Start now"). */
export async function startScheduledHuddle(
  startedBy: string,
  id: string,
): Promise<StartResult> {
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("zoom_huddles")
    .select("id, join_url, ended_at, started_at")
    .eq("id", id)
    .maybeSingle();

  // If it's gone / already ended / already live, just start a fresh one.
  if (!row || row.ended_at || row.started_at) {
    return startHuddle(startedBy);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + HUDDLE_WINDOW_MIN * 60_000).toISOString();

  // Close any other pending/live huddles, then promote this row.
  await supabase
    .from("zoom_huddles")
    .update({ ended_at: now.toISOString() })
    .is("ended_at", null)
    .neq("id", id);

  const { error } = await supabase
    .from("zoom_huddles")
    .update({ started_at: now.toISOString(), ends_at: endsAt, started_by: startedBy })
    .eq("id", id);
  if (error) return { error: error.message };

  let startUrl = "";
  try {
    const pmi = await getPmiJoinInfo();
    startUrl = pmi.startUrl || "";
  } catch {
    /* the stored join_url is enough to run the huddle */
  }

  await broadcastLive(supabase, row.join_url as string, startedBy);
  return { id, joinUrl: row.join_url as string, startUrl };
}

/** End/cancel a huddle. With an id, that specific one; otherwise every open one. */
export async function endHuddle(id?: string): Promise<void> {
  const supabase = createServiceClient();
  let query = supabase
    .from("zoom_huddles")
    .update({ ended_at: new Date().toISOString() })
    .is("ended_at", null);
  if (id) query = query.eq("id", id);
  await query;
}

/**
 * Fire scheduled-huddle reminders. Owned by /api/cron/huddle-reminders.
 * Each reminder is claimed atomically (UPDATE … WHERE reminded_*_at IS NULL)
 * so a cron tick broadcasts each nudge at most once.
 */
export async function processHuddleReminders(): Promise<void> {
  const supabase = createServiceClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const soonIso = new Date(now + 10 * 60_000).toISOString();
  const graceIso = new Date(now - SCHEDULE_GRACE_MIN * 60_000).toISOString();

  // ~10 minutes before: heads-up to all active staff.
  const { data: soon } = await supabase
    .from("zoom_huddles")
    .update({ reminded_soon_at: nowIso })
    .is("started_at", null)
    .is("ended_at", null)
    .is("reminded_soon_at", null)
    .lte("scheduled_at", soonIso)
    .gt("scheduled_at", nowIso)
    .select("id, topic");
  if (soon && soon.length) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_active", true);
    for (const h of soon) {
      const suffix = h.topic ? ` — ${h.topic}` : "";
      const rows = (staff ?? []).map((p) => ({
        userId: p.id as string,
        kind: "huddle",
        title: `⏰ Team huddle soon${suffix}`,
        body: "Starting in about 10 minutes — hang tight for the join link.",
        href: "/",
      }));
      await insertNotifications(supabase, rows);
    }
  }

  // Start time reached: nudge admins to start it (it does not auto-go-live).
  const { data: due } = await supabase
    .from("zoom_huddles")
    .update({ reminded_start_at: nowIso })
    .is("started_at", null)
    .is("ended_at", null)
    .is("reminded_start_at", null)
    .lte("scheduled_at", nowIso)
    .gt("scheduled_at", graceIso)
    .select("id, topic");
  if (due && due.length) {
    for (const h of due) {
      const suffix = h.topic ? ` — ${h.topic}` : "";
      await notifyAdmins(supabase, {
        kind: "huddle",
        title: `🔔 Time to start the team huddle${suffix}`,
        body: "Open the hub and hit Start to bring everyone on.",
        href: "/",
      });
    }
  }
}
