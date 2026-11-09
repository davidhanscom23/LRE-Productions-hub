import { maybeAutoSyncPacketsAction } from "@/app/(app)/event-packets/auto-sync";
import { EventPacketsPageClient } from "@/components/event-packets/event-packets-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { listVenuesWithAliases } from "@/lib/event-packets/venues";
import { createClient } from "@/lib/supabase/server";
import type { EventPacket } from "@/lib/types/event-packets";
import { redirect } from "next/navigation";

export default async function EventPacketsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  // Throttled company-calendar sync (service role + CRON_SECRET path also exists).
  if (isAdmin) {
    await maybeAutoSyncPacketsAction();
  }

  const select = `
    *,
    assignee:profiles!event_packets_assignee_id_fkey (
      id, full_name, email, avatar_url
    ),
    venue:venues!event_packets_venue_id_fkey (
      id, name, folder_slug
    )
  `;

  const { data: myRows, error: myError } = await supabase
    .from("event_packets")
    .select(select)
    .eq("assignee_id", profile.id)
    .order("event_date", { ascending: false });

  if (myError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Event Packets need a database update</p>
        <p className="mt-2">
          Run migration <code>026_event_packets_venues.sql</code> in Supabase,
          then refresh. ({myError.message})
        </p>
      </div>
    );
  }

  let allPackets: EventPacket[] = [];
  if (isAdmin) {
    const { data: allRows } = await supabase
      .from("event_packets")
      .select(select)
      .order("event_date", { ascending: false })
      .limit(300);
    allPackets = (allRows ?? []) as EventPacket[];
  }

  const venues = await listVenuesWithAliases();

  // Library: admins see all tagged uploads; staff/trainers see only their own.
  let mediaQuery = supabase
    .from("event_media")
    .select(
      "id, file_name, folder_path, location_name, event_date, dj_name, client_name",
    )
    .not("folder_path", "eq", "")
    .order("event_date", { ascending: false })
    .limit(500);
  if (!isAdmin) {
    mediaQuery = mediaQuery.eq("uploader_id", profile.id);
  }
  const { data: mediaRows } = await mediaQuery;

  const libraryItems = (mediaRows ?? []).map((row) => ({
    id: row.id as string,
    file_name: String(row.file_name ?? ""),
    folder_path: String(row.folder_path ?? ""),
    location_name: String(row.location_name ?? ""),
    event_date: String(row.event_date ?? ""),
    dj_name: String(row.dj_name ?? ""),
    client_name: String(row.client_name ?? ""),
  }));

  return (
    <EventPacketsPageClient
      myPackets={(myRows ?? []) as EventPacket[]}
      allPackets={allPackets}
      venues={venues}
      libraryItems={libraryItems}
      isAdmin={isAdmin}
    />
  );
}
