import { ProposalsListClient } from "@/components/proposals/proposals-list-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isDriveConfigured } from "@/lib/drive/client";
import { createClient } from "@/lib/supabase/server";
import type { Proposal } from "@/lib/types/proposals";
import type { Quote } from "@/lib/types/quoting";
import { redirect } from "next/navigation";

export default async function ProposalsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const driveConfigured = await isDriveConfigured();

  const { data: proposalRows, error } = await supabase
    .from("proposals")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Proposals needs a database update</p>
        <p className="mt-2">
          Run migration <code>123_proposals.sql</code> in Supabase, then refresh.
          ({error.message})
        </p>
      </div>
    );
  }

  let rows = (proposalRows ?? []) as Record<string, unknown>[];
  if (!isAdmin) {
    rows = rows.filter((r) => String(r.created_by) === profile.id);
  }

  const creatorIds = Array.from(
    new Set(rows.map((r) => String(r.created_by))),
  );
  const { data: creators } = creatorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", creatorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map(
    (creators ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const proposals: Proposal[] = rows.map((r) => ({
    id: String(r.id),
    quote_id: r.quote_id ? String(r.quote_id) : null,
    created_by: String(r.created_by),
    client_name: String(r.client_name ?? ""),
    event_name: String(r.event_name ?? ""),
    event_date: (r.event_date as string) ?? null,
    department: String(r.department ?? "General"),
    title: String(r.title ?? "Proposal"),
    intro: String(r.intro ?? ""),
    notes: String(r.notes ?? ""),
    status: (r.status as Proposal["status"]) ?? "draft",
    list_total: Number(r.list_total) || 0,
    quote_total: Number(r.quote_total) || 0,
    lines_snapshot: Array.isArray(r.lines_snapshot)
      ? (r.lines_snapshot as Proposal["lines_snapshot"])
      : [],
    drive_file_id: r.drive_file_id ? String(r.drive_file_id) : null,
    drive_web_view_link: String(r.drive_web_view_link ?? ""),
    drive_folder_path: String(r.drive_folder_path ?? ""),
    pipeline_project_id: r.pipeline_project_id
      ? String(r.pipeline_project_id)
      : null,
    pipeline_linked_at: (r.pipeline_linked_at as string) ?? null,
    generated_at: (r.generated_at as string) ?? null,
    uploaded_at: (r.uploaded_at as string) ?? null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    creator_name: nameById.get(String(r.created_by)),
  }));

  let readyQuery = supabase
    .from("quotes")
    .select("id, client_name, event_name, event_date, department, status, updated_at, created_by")
    .eq("status", "ready")
    .order("updated_at", { ascending: false })
    .limit(40);
  if (!isAdmin) readyQuery = readyQuery.eq("created_by", profile.id);
  const { data: readyRows } = await readyQuery;

  const readyQuotes: Pick<
    Quote,
    | "id"
    | "client_name"
    | "event_name"
    | "event_date"
    | "department"
    | "status"
    | "updated_at"
    | "created_by"
  >[] = ((readyRows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    client_name: String(r.client_name ?? ""),
    event_name: String(r.event_name ?? ""),
    event_date: (r.event_date as string) ?? null,
    department: String(r.department ?? "General"),
    status: "ready",
    updated_at: String(r.updated_at ?? ""),
    created_by: String(r.created_by),
  }));

  return (
    <ProposalsListClient
      isAdmin={isAdmin}
      driveConfigured={driveConfigured}
      proposals={proposals}
      readyQuotes={readyQuotes}
    />
  );
}
