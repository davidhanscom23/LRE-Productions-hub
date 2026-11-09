import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PacketCompleteForm } from "@/components/event-packets/packet-complete-form";
import { PacketReviewsPanel } from "@/components/event-packets/packet-reviews-panel";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getReviewsForPacket } from "@/lib/reviews/for-packet";
import {
  getEventMediaAccessUrl,
  getEventMediaThumbAccessUrl,
} from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import type { EventPacket } from "@/lib/types/event-packets";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventPacketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const isTrainer = profile.role === "trainer";

  const { data: packet, error } = await supabase
    .from("event_packets")
    .select(
      `
      *,
      assignee:profiles!event_packets_assignee_id_fkey (
        id, full_name, email, avatar_url
      ),
      venue:venues!event_packets_venue_id_fkey (
        id, name, folder_slug
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !packet) notFound();

  if (
    packet.assignee_id !== profile.id &&
    !isAdmin &&
    !isTrainer
  ) {
    redirect("/event-packets");
  }

  // Recap is master: heal any out-of-date photo tags/folders when opening.
  const canRewriteMedia = packet.assignee_id === profile.id || isAdmin;
  if (canRewriteMedia) {
    try {
      const { ensurePacketMediaMatchesRecap } = await import(
        "@/lib/event-packets/sync-media-from-recap"
      );
      const venueName =
        (packet.venue as { name?: string } | null)?.name ||
        String(packet.venue_raw ?? "");
      await ensurePacketMediaMatchesRecap({
        supabase,
        packetId: id,
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
    } catch {
      // Page still loads; assignee can use Sync tags manually.
    }
  }

  const { data: media } = await supabase
    .from("event_media")
    .select(
      "id, file_name, original_file_name, media_type, sequence_number, folder_path, storage_path, storage_provider, uploader_id, location_name, client_name, event_type, dj_name, event_date",
    )
    .eq("packet_id", id)
    .order("sequence_number", { ascending: true });

  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (item) => {
      const provider =
        item.storage_provider === "bunny" || item.storage_provider === "supabase"
          ? item.storage_provider
          : "supabase";
      const [access, thumb] = await Promise.all([
        getEventMediaAccessUrl({
          supabase,
          path: String(item.storage_path ?? ""),
          provider,
          expiresIn: 3600,
        }),
        getEventMediaThumbAccessUrl({
          supabase,
          path: String(item.storage_path ?? ""),
          provider,
          expiresIn: 86400,
        }),
      ]);
      return {
        id: item.id as string,
        file_name: String(item.file_name ?? ""),
        original_file_name: String(item.original_file_name ?? ""),
        media_type: String(item.media_type ?? ""),
        sequence_number:
          typeof item.sequence_number === "number" ? item.sequence_number : null,
        folder_path: String(item.folder_path ?? ""),
        storage_path: String(item.storage_path ?? ""),
        storage_provider: provider as "supabase" | "bunny",
        uploader_id: String(item.uploader_id ?? ""),
        signed_url: access.url,
        thumb_url: thumb.url,
      };
    }),
  );

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name", { ascending: true });

  const reviews = await getReviewsForPacket(
    supabase,
    (packet as EventPacket).calendar_uid,
  );

  let honeybookProjectId =
    (packet as { honeybook_project_id?: string | null }).honeybook_project_id ??
    null;
  let honeybookProjectName: string | null = null;

  // HoneyBook mirror: admins + Leads (trainer) can SELECT after mig 159.
  if (isAdmin || isTrainer) {
    try {
      const { ensurePacketHoneyBookLink } = await import(
        "@/lib/event-packets/honeybook-link"
      );
      const ensured = await ensurePacketHoneyBookLink(supabase, {
        id,
        event_date: String(packet.event_date ?? ""),
        client_name: String(packet.client_name ?? ""),
        honeybook_project_id: honeybookProjectId,
      });
      if (ensured.projectId) honeybookProjectId = ensured.projectId;
    } catch {
      // CRM link is optional; page still loads.
    }

    if (honeybookProjectId) {
      const { data: hb } = await supabase
        .from("honeybook_projects")
        .select("id, name, stage")
        .eq("id", honeybookProjectId)
        .maybeSingle();
      if (hb) {
        honeybookProjectName = `${hb.name}${hb.stage ? ` · ${hb.stage}` : ""}`;
      }
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href="/event-packets"
        className="text-sm font-medium text-[var(--brand)] hover:underline"
      >
        ← Back to Event Packets
      </Link>
      <PacketReviewsPanel reviews={reviews} />
      <PacketCompleteForm
        packet={
          {
            ...(packet as EventPacket),
            honeybook_project_id: honeybookProjectId,
          } as EventPacket
        }
        media={mediaWithUrls}
        venues={(venues ?? []) as { id: string; name: string }[]}
        currentUserId={profile.id}
        isAdmin={isAdmin}
        isTrainer={isTrainer}
        honeybookProjectName={honeybookProjectName}
      />
    </div>
  );
}
