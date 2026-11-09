import { FloorPlanEditor } from "@/components/floor-plans/floor-plan-editor";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessHoneyBook, canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { floorPlanShareUrl } from "@/lib/floor-plans/public";
import { sanitizePlanData } from "@/lib/floor-plans/types";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function FloorPlanEditorPage({ params }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessHoneyBook(profile.role)) redirect("/");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("floor_plans")
    .select("id, project_id, is_template, name, space_name, status, share_token, data")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const published = row.status === "published" && row.share_token;
  return (
    <div className="mx-auto max-w-[1500px]">
      <FloorPlanEditor
        planId={row.id as string}
        initialName={row.name as string}
        initialSpaceName={(row.space_name as string) ?? ""}
        initialData={sanitizePlanData(row.data)}
        isTemplate={Boolean(row.is_template)}
        initialPublishedUrl={published ? floorPlanShareUrl(row.share_token as string) : null}
        canSaveTemplate={canManageHoneyBookCrm(profile.role)}
        backHref={row.project_id ? `/honeybook/projects/${row.project_id}` : "/floor-plans"}
      />
    </div>
  );
}
