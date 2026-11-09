import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkableProject = {
  id: string;
  name: string;
  project_date: string | null;
};

/** The Hub project (event card) an AV estimate is linked to. Safe before migration 192. */
export async function loadEstimateProjectLink(
  supabase: SupabaseClient,
  opportunityId: string | null | undefined,
): Promise<string | null> {
  if (!opportunityId) return null;
  try {
    const { data, error } = await supabase
      .from("av_opportunities")
      .select("honeybook_project_id")
      .eq("id", opportunityId)
      .maybeSingle();
    if (error) return null;
    return (data as { honeybook_project_id?: string | null } | null)?.honeybook_project_id ?? null;
  } catch {
    return null;
  }
}

/** Events an estimate can be linked to: newest event dates first. */
export async function loadLinkableProjects(
  supabase: SupabaseClient,
  alsoInclude?: string | null,
): Promise<LinkableProject[]> {
  const { data, error } = await supabase
    .from("honeybook_projects")
    .select("id, name, project_date")
    .order("project_date", { ascending: false, nullsFirst: false })
    .limit(400);
  if (error) return [];
  const rows = (data ?? []) as LinkableProject[];
  if (alsoInclude && !rows.some((r) => r.id === alsoInclude)) {
    const { data: extra } = await supabase
      .from("honeybook_projects")
      .select("id, name, project_date")
      .eq("id", alsoInclude)
      .maybeSingle();
    if (extra) rows.unshift(extra as LinkableProject);
  }
  return rows;
}
