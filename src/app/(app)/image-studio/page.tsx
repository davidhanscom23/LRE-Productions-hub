import { redirect } from "next/navigation";
import {
  ImageStudioClient,
  type ImageStudioLibraryItem,
  type ImageStudioPacketOption,
} from "@/components/image-studio/image-studio-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import { isHiggsfieldConfigured } from "@/lib/higgsfield/credentials";
import { resolveStudioImageModelId } from "@/lib/social/image-gen-models";
import { getEventMediaAccessUrl } from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

export default async function ImageStudioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();

  const { data: packetRows } = await supabase
    .from("event_packets")
    .select(
      `
      id, client_name, event_date, dj_name, venue_raw, status,
      venue:venues!event_packets_venue_id_fkey ( name )
    `,
    )
    .order("event_date", { ascending: false })
    .limit(150);

  const packets: ImageStudioPacketOption[] = (packetRows ?? []).map((packet) => {
    const venueRel = packet.venue as
      | { name?: string }
      | { name?: string }[]
      | null;
    const venueName =
      (Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name) ||
      packet.venue_raw ||
      "Venue";
    const status =
      packet.status === "completed" ? "" : ` · ${String(packet.status)}`;
    return {
      id: packet.id as string,
      label: `${packet.event_date} · ${packet.client_name || "Event"} · ${venueName}${status}`,
    };
  });

  const { data: libraryRows, error: libraryError } = await supabase
    .from("studio_images")
    .select(
      "id, prompt, model_id, provider, aspect_ratio, image_size, file_name, storage_path, storage_provider, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const libraryReady = !libraryError;
  const library: ImageStudioLibraryItem[] = [];

  if (libraryReady) {
    for (const row of libraryRows ?? []) {
      const access = await getEventMediaAccessUrl({
        supabase,
        path: String(row.storage_path ?? ""),
        provider:
          row.storage_provider === "bunny" || row.storage_provider === "supabase"
            ? row.storage_provider
            : "supabase",
      });
      library.push({
        id: row.id as string,
        prompt: String(row.prompt ?? ""),
        model_id: String(row.model_id ?? ""),
        provider: String(row.provider ?? ""),
        aspect_ratio: String(row.aspect_ratio ?? "4:5"),
        image_size: (row.image_size as string | null) ?? null,
        file_name: String(row.file_name ?? "image.png"),
        preview_url: access.url,
        created_at: String(row.created_at ?? ""),
      });
    }
  }

  return (
    <ImageStudioClient
      geminiConfigured={isGeminiConfigured()}
      higgsfieldConfigured={isHiggsfieldConfigured()}
      defaultModelId={resolveStudioImageModelId()}
      library={library}
      packets={packets}
      libraryReady={libraryReady}
      libraryError={libraryError?.message ?? null}
    />
  );
}
