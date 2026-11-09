import "server-only";

import { crmLabelsMatch } from "@/lib/event-packets/honeybook-link-match";
import type { SupabaseClient } from "@supabase/supabase-js";

export type HoneyBookProjectMatch = {
  id: string;
  name: string;
  stage: string;
  project_date: string | null;
  client_name: string | null;
};

/**
 * Find HoneyBook mirror projects for a packet date + client. Returns all
 * plausible matches (caller decides unique auto-link vs picker).
 */
export async function findHoneyBookProjectsForPacket(
  supabase: SupabaseClient,
  input: { eventDate: string; clientName: string },
): Promise<HoneyBookProjectMatch[]> {
  const eventDate = input.eventDate?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return [];

  const { data, error } = await supabase
    .from("honeybook_projects")
    .select(
      "id, name, stage, project_date, client:honeybook_clients!honeybook_projects_client_id_fkey ( full_name )",
    )
    .eq("project_date", eventDate)
    .limit(40);

  if (error || !data) return [];

  const matches: HoneyBookProjectMatch[] = [];
  for (const row of data) {
    const client = row.client as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const c = Array.isArray(client) ? client[0] : client;
    const clientName = c?.full_name ?? null;
    if (
      !crmLabelsMatch(input.clientName, row.name as string, clientName)
    ) {
      continue;
    }
    matches.push({
      id: row.id as string,
      name: String(row.name ?? ""),
      stage: String(row.stage ?? ""),
      project_date: (row.project_date as string | null) ?? null,
      client_name: clientName,
    });
  }
  return matches;
}

/**
 * If the packet has no FK yet and exactly one CRM project matches date+client,
 * set honeybook_project_id. Returns the linked project id (existing or new).
 */
export async function ensurePacketHoneyBookLink(
  supabase: SupabaseClient,
  packet: {
    id: string;
    event_date: string;
    client_name: string;
    honeybook_project_id?: string | null;
  },
): Promise<{ projectId: string | null; linked: boolean }> {
  if (packet.honeybook_project_id) {
    return { projectId: packet.honeybook_project_id, linked: false };
  }

  const matches = await findHoneyBookProjectsForPacket(supabase, {
    eventDate: packet.event_date,
    clientName: packet.client_name,
  });
  if (matches.length !== 1) {
    return { projectId: null, linked: false };
  }

  const projectId = matches[0].id;
  const { error } = await supabase
    .from("event_packets")
    .update({
      honeybook_project_id: projectId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", packet.id)
    .is("honeybook_project_id", null);

  if (error) return { projectId: null, linked: false };
  return { projectId, linked: true };
}
