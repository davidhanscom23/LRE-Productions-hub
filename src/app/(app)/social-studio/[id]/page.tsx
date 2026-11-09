import { notFound, redirect } from "next/navigation";
import { SocialPacketStudioClient } from "@/components/social/social-packet-studio-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isDriveConfigured } from "@/lib/drive/client";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import { isHiggsfieldConfigured } from "@/lib/higgsfield/credentials";
import { resolveStudioImageModelId } from "@/lib/social/image-gen-models";
import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social/platforms";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Image generation (Gemini / Higgsfield poll) can run for a few minutes. */
export const maxDuration = 120;

export default async function SocialPacketStudioPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const isElevated = isAdmin || profile.role === "trainer";

  const { data: packet, error } = await supabase
    .from("event_packets")
    .select(
      `
      id, assignee_id, client_name, event_date, event_type, dj_name, venue_raw, status,
      social_consent, social_consent_notes,
      venue:venues!event_packets_venue_id_fkey ( name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !packet) notFound();
  if (packet.assignee_id !== profile.id && !isElevated) {
    redirect("/social-studio");
  }

  const { data: captionRows } = await supabase
    .from("social_captions")
    .select("platform, caption")
    .eq("packet_id", id);

  const captions = Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform) => [platform, ""]),
  ) as Record<SocialPlatform, string>;

  for (const row of captionRows ?? []) {
    const platform = row.platform as SocialPlatform;
    if (SOCIAL_PLATFORMS.includes(platform)) {
      captions[platform] = String(row.caption ?? "");
    }
  }

  const { data: mediaRows } = await supabase
    .from("event_media")
    .select(
      "id, file_name, storage_path, media_type, drive_file_id, drive_synced_at",
    )
    .eq("packet_id", id)
    .order("sequence_number", { ascending: true });

  const venueRel = packet.venue as
    | { name?: string }
    | { name?: string }[]
    | null;
  const venueName =
    (Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name) ||
    packet.venue_raw ||
    "Venue";

  return (
    <SocialPacketStudioClient
      packetId={packet.id as string}
      title={String(packet.client_name || "Event")}
      subtitle={`${packet.event_date} · ${venueName} · ${packet.dj_name} · ${packet.event_type}`}
      isAdmin={isAdmin}
      canQueueMarketing={isElevated}
      packetCompleted={packet.status === "completed"}
      driveConfigured={await isDriveConfigured()}
      geminiConfigured={isGeminiConfigured()}
      higgsfieldConfigured={isHiggsfieldConfigured()}
      studioImageDefaultModelId={resolveStudioImageModelId()}
      socialConsent={Boolean(
        (packet as { social_consent?: boolean }).social_consent,
      )}
      socialConsentNotes={String(
        (packet as { social_consent_notes?: string }).social_consent_notes ?? "",
      )}
      initialCaptions={captions}
      media={(mediaRows ?? []).map((row) => ({
        id: row.id as string,
        file_name: String(row.file_name ?? ""),
        storage_path: String(row.storage_path ?? ""),
        media_type: String(row.media_type ?? ""),
        drive_file_id: (row.drive_file_id as string | null) ?? null,
        drive_synced_at: (row.drive_synced_at as string | null) ?? null,
      }))}
    />
  );
}
