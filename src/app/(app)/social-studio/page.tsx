import { SocialStudioPageClient } from "@/components/social/social-studio-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isDriveConfigured } from "@/lib/drive/client";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SocialStudioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const isElevated = profile.role === "admin" || profile.role === "trainer";

  let query = supabase
    .from("event_packets")
    .select(
      `
      id, client_name, event_date, event_type, dj_name, venue_raw, status,
      venue:venues!event_packets_venue_id_fkey ( name )
    `,
    )
    .eq("status", "completed")
    .order("event_date", { ascending: false })
    .limit(100);

  if (!isElevated) {
    query = query.eq("assignee_id", profile.id);
  }

  const { data: packets, error } = await query;

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Social Studio needs a database update</p>
        <p className="mt-2">
          Run migration <code>027_social_studio_drive.sql</code> in Supabase,
          then refresh. ({error.message})
        </p>
      </div>
    );
  }

  const ids = (packets ?? []).map((row) => row.id as string);
  const mediaCounts = new Map<string, number>();
  const captionCounts = new Map<string, number>();

  if (ids.length) {
    const { data: mediaRows } = await supabase
      .from("event_media")
      .select("packet_id")
      .in("packet_id", ids);
    for (const row of mediaRows ?? []) {
      const key = row.packet_id as string;
      mediaCounts.set(key, (mediaCounts.get(key) ?? 0) + 1);
    }

    const { data: captionRows } = await supabase
      .from("social_captions")
      .select("packet_id")
      .in("packet_id", ids);
    for (const row of captionRows ?? []) {
      const key = row.packet_id as string;
      captionCounts.set(key, (captionCounts.get(key) ?? 0) + 1);
    }
  }

  const rows = (packets ?? []).map((packet) => {
    const venueRel = packet.venue as
      | { name?: string }
      | { name?: string }[]
      | null;
    const venueName = Array.isArray(venueRel)
      ? venueRel[0]?.name
      : venueRel?.name;
    return {
      id: packet.id as string,
      client_name: String(packet.client_name ?? ""),
      event_date: String(packet.event_date ?? ""),
      event_type: String(packet.event_type ?? ""),
      dj_name: String(packet.dj_name ?? ""),
      venue_label: venueName || String(packet.venue_raw ?? "Venue"),
      status: String(packet.status ?? ""),
      media_count: mediaCounts.get(packet.id as string) ?? 0,
      caption_count: captionCounts.get(packet.id as string) ?? 0,
    };
  });

  return (
    <SocialStudioPageClient
      packets={rows}
      driveConfigured={await isDriveConfigured()}
    />
  );
}
