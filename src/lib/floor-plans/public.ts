import "server-only";

import { randomBytes } from "node:crypto";
import { getPublicBaseUrl } from "@/lib/av-portals/emails";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { sanitizePlanData, type FloorPlanData } from "./types";

export const FLOOR_PLAN_BUCKET = "floor-plan-blueprints";
export const FLOOR_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function newFloorPlanToken(): string {
  return randomBytes(18).toString("base64url");
}

export function floorPlanShareUrl(token: string): string {
  return `${getPublicBaseUrl()}/floorplan/${token}`;
}

export type PublicFloorPlan = {
  id: string;
  name: string;
  spaceName: string;
  projectName: string | null;
  data: FloorPlanData;
  blueprintUrl: string | null;
};

/** Load a PUBLISHED plan by its share token (service role; no staff session needed). */
export async function loadPublicFloorPlan(
  token: string,
): Promise<PublicFloorPlan | null> {
  if (!FLOOR_TOKEN_RE.test(token) || !isServiceRoleConfigured()) return null;
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("floor_plans")
    .select("id, name, space_name, data, project_id")
    .eq("share_token", token)
    .eq("status", "published")
    .eq("is_template", false)
    .maybeSingle();
  if (!row) return null;
  const data = sanitizePlanData(row.data);
  let projectName: string | null = null;
  if (row.project_id) {
    const { data: p } = await supabase
      .from("pipeline_projects")
      .select("name")
      .eq("id", row.project_id)
      .maybeSingle();
    projectName = (p?.name as string | undefined) ?? null;
  }
  let blueprintUrl: string | null = null;
  if (data.blueprint) {
    const { data: signed } = await supabase.storage
      .from(FLOOR_PLAN_BUCKET)
      .createSignedUrl(data.blueprint.path, 60 * 60);
    blueprintUrl = signed?.signedUrl ?? null;
  }
  return {
    id: row.id as string,
    name: row.name as string,
    spaceName: (row.space_name as string) ?? "",
    projectName,
    data,
    blueprintUrl,
  };
}
