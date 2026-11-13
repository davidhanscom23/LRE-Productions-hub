import { getCurrentProfile } from "@/lib/auth/profile";
import { COMPANY } from "@/lib/company";
import { canAccessPipeline } from "@/lib/pipeline/access";
import { buildContractPdf } from "@/lib/project-contracts/pdf";
import { CONTRACT_BUCKET } from "@/lib/project-contracts/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Staff download: the archived signed PDF when there is one, otherwise a preview of the current text. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || !canAccessPipeline(profile.role)) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("project_contracts")
    .select("title, body, status, project_id, signed_pdf_path")
    .eq("id", id)
    .maybeSingle();
  if (!c) return new Response("Not found", { status: 404 });

  let bytes: Uint8Array | null = null;
  if (c.signed_pdf_path && isServiceRoleConfigured()) {
    const { data: file } = await createServiceClient().storage.from(CONTRACT_BUCKET).download(c.signed_pdf_path as string);
    if (file) bytes = new Uint8Array(await file.arrayBuffer());
  }
  if (!bytes) {
    const { data: p } = await supabase.from("pipeline_projects").select("name").eq("id", c.project_id).maybeSingle();
    bytes = await buildContractPdf({
      companyName: COMPANY.displayName,
      title: String(c.title),
      body: String(c.body),
      projectName: String(p?.name ?? ""),
    });
  }
  const safe = String(c.title).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "contract";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safe}${c.status === "signed" ? "-signed" : ""}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
