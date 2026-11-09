import { ProposalsDetailClient } from "@/components/proposals/proposals-detail-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isDriveConfigured } from "@/lib/drive/client";
import { createClient } from "@/lib/supabase/server";
import type { Proposal } from "@/lib/types/proposals";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ProposalDetailPage({ params }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const { id } = await params;
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const driveConfigured = await isDriveConfigured();

  const { data: row, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

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
  if (!row) notFound();
  if (row.created_by !== profile.id && !isAdmin) redirect("/proposals");

  let honeybookProjectName: string | null = null;
  if (row.honeybook_project_id && isAdmin) {
    const { data: project } = await supabase
      .from("honeybook_projects")
      .select("name")
      .eq("id", row.honeybook_project_id)
      .maybeSingle();
    honeybookProjectName = project?.name ? String(project.name) : null;
  }

  const proposal: Proposal = {
    id: String(row.id),
    quote_id: row.quote_id ? String(row.quote_id) : null,
    created_by: String(row.created_by),
    client_name: String(row.client_name ?? ""),
    event_name: String(row.event_name ?? ""),
    event_date: (row.event_date as string) ?? null,
    department: String(row.department ?? "General"),
    title: String(row.title ?? "Proposal"),
    intro: String(row.intro ?? ""),
    notes: String(row.notes ?? ""),
    status: (row.status as Proposal["status"]) ?? "draft",
    list_total: Number(row.list_total) || 0,
    quote_total: Number(row.quote_total) || 0,
    lines_snapshot: Array.isArray(row.lines_snapshot)
      ? (row.lines_snapshot as Proposal["lines_snapshot"])
      : [],
    drive_file_id: row.drive_file_id ? String(row.drive_file_id) : null,
    drive_web_view_link: String(row.drive_web_view_link ?? ""),
    drive_folder_path: String(row.drive_folder_path ?? ""),
    honeybook_project_id: row.honeybook_project_id
      ? String(row.honeybook_project_id)
      : null,
    honeybook_linked_at: (row.honeybook_linked_at as string) ?? null,
    generated_at: (row.generated_at as string) ?? null,
    uploaded_at: (row.uploaded_at as string) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    honeybook_project_name: honeybookProjectName,
  };

  return (
    <ProposalsDetailClient
      isAdmin={isAdmin}
      driveConfigured={driveConfigured}
      proposal={proposal}
    />
  );
}
