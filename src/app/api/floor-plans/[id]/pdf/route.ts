import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessPipeline } from "@/lib/pipeline/access";
import { FLOOR_PLAN_BUCKET } from "@/lib/floor-plans/public";
import { buildFloorPlanPdf } from "@/lib/floor-plans/pdf";
import { sanitizePlanData } from "@/lib/floor-plans/types";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || !canAccessPipeline(profile.role)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("floor_plans")
    .select("name, space_name, data, project_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return new Response("Not found", { status: 404 });
  const data = sanitizePlanData(row.data);

  let projectName = "";
  if (row.project_id) {
    const { data: p } = await supabase.from("pipeline_projects").select("name").eq("id", row.project_id).maybeSingle();
    projectName = (p?.name as string | undefined) ?? "";
  }

  let blueprint: { bytes: Uint8Array; type: "png" | "jpg" } | null = null;
  if (data.blueprint && isServiceRoleConfigured() && !data.blueprint.path.endsWith(".webp")) {
    const { data: file } = await createServiceClient().storage.from(FLOOR_PLAN_BUCKET).download(data.blueprint.path);
    if (file) {
      blueprint = {
        bytes: new Uint8Array(await file.arrayBuffer()),
        type: data.blueprint.path.endsWith(".png") ? "png" : "jpg",
      };
    }
  }

  const bytes = await buildFloorPlanPdf({
    title: row.name as string,
    subtitle: [projectName, row.space_name as string].filter(Boolean).join(" · "),
    data,
    blueprint,
  });
  const safe = String(row.name).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "floor-plan";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safe}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
