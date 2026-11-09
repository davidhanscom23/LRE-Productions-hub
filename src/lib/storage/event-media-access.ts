import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether the signed-in user may mint an access URL for a storage path.
 * Own paths always allowed; expense receipts stay owner/admin; other media
 * allows admin, trainer, uploader, or the packet assignee.
 */
export async function canAccessEventMediaPath(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<boolean> {
  const clean = path.trim().replace(/^\//, "");
  if (!clean || clean.includes("..")) return false;
  if (clean.startsWith(`${userId}/`)) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = profile?.role ?? null;

  if (role === "admin") return true;

  // Receipts / private expense objects — never share with trainers or peers.
  if (/(^|\/)expenses\//.test(clean)) return false;

  if (role === "trainer") return true;

  const { data: media } = await supabase
    .from("event_media")
    .select("uploader_id, packet_id")
    .eq("storage_path", clean)
    .maybeSingle();

  if (!media) return false;
  if (String(media.uploader_id) === userId) return true;

  const packetId = media.packet_id ? String(media.packet_id) : "";
  if (!packetId) return false;

  const { data: packet } = await supabase
    .from("event_packets")
    .select("assignee_id")
    .eq("id", packetId)
    .maybeSingle();

  return String(packet?.assignee_id ?? "") === userId;
}
