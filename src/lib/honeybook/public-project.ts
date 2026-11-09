import "server-only";

import { randomBytes } from "node:crypto";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { getPublicBaseUrl } from "@/lib/av-portals/emails";
import type { CrmProjectFile } from "@/lib/honeybook/file-requests";
import {
  sanitizeCrmAnswers,
  type CrmQuestionnaireAnswers,
} from "@/lib/honeybook/questionnaire";

export const PROJECT_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function newProjectShareToken(): string {
  return randomBytes(18).toString("base64url");
}

export function projectShareUrl(token: string): string {
  return `${getPublicBaseUrl()}/project/${token}`;
}

export type PublicCrmProject = {
  id: string;
  name: string;
  stage: string;
  projectType: string;
  projectDate: string | null;
  location: string;
  details: string;
  budget: number | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  files: CrmProjectFile[];
  questionnaireAnswers: CrmQuestionnaireAnswers;
  questionnaireSubmittedAt: string | null;
};

export async function loadSharedProjectRow(token: string) {
  if (!PROJECT_TOKEN_RE.test(token)) return null;
  if (!isServiceRoleConfigured()) return null;
  const supabase = createServiceClient();
  const { data: project, error } = await supabase
    .from("honeybook_projects")
    .select(
      "id, name, stage, project_type, project_date, location, details, budget, client_id, share_enabled, share_token",
    )
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  if (error || !project) return null;
  return { supabase, project };
}

export async function loadPublicProjectByToken(
  token: string,
): Promise<PublicCrmProject | null> {
  const loaded = await loadSharedProjectRow(token);
  if (!loaded) return null;
  const { supabase, project } = loaded;

  let clientName: string | null = null;
  let clientEmail: string | null = null;
  let clientPhone: string | null = null;
  if (project.client_id) {
    const { data: client } = await supabase
      .from("honeybook_clients")
      .select("full_name, email, phone")
      .eq("id", project.client_id)
      .maybeSingle();
    if (client) {
      clientName = client.full_name || null;
      clientEmail = client.email || null;
      clientPhone = client.phone || null;
    }
  }

  const { data: fileRows } = await supabase
    .from("honeybook_project_files")
    .select(
      "id, project_id, item_key, file_name, mime_type, size_bytes, uploaded_at",
    )
    .eq("project_id", project.id)
    .order("uploaded_at", { ascending: false });

  const { data: qRow } = await supabase
    .from("honeybook_project_questionnaire_answers")
    .select("answers, submitted_at")
    .eq("project_id", project.id)
    .maybeSingle();

  const budgetRaw = project.budget;
  const budget =
    budgetRaw == null || budgetRaw === "" ? null : Number(budgetRaw);

  return {
    id: project.id as string,
    name: String(project.name ?? ""),
    stage: String(project.stage ?? ""),
    projectType: String(project.project_type ?? ""),
    projectDate: (project.project_date as string | null) ?? null,
    location: String(project.location ?? ""),
    details: String(project.details ?? ""),
    budget: budget != null && Number.isFinite(budget) ? budget : null,
    clientName,
    clientEmail,
    clientPhone,
    files: (fileRows ?? []) as CrmProjectFile[],
    questionnaireAnswers: sanitizeCrmAnswers(
      (qRow?.answers as Record<string, unknown> | null) ?? null,
    ),
    questionnaireSubmittedAt: (qRow?.submitted_at as string | null) ?? null,
  };
}
