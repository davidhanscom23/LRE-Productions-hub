import { redirect } from "next/navigation";
import { GearScanClient } from "@/components/gear-scan/gear-scan-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canScanGear, isGearAdmin } from "@/lib/gear-tags/access";
import { parseTagCode } from "@/lib/gear-tags/parse";
import { loadGearBoard } from "@/lib/gear-tags/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata = { title: "Gear scan — LRE" };

type Props = { searchParams: Promise<{ tag?: string; project?: string }> };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export default async function GearScanPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (!canScanGear(profile)) {
    return <Notice title="Gear scan is for LRE staff">Ask an admin if you need access.</Notice>;
  }
  if (!isServiceRoleConfigured()) {
    return (
      <Notice title="Gear scan is not set up on the server yet">
        An admin needs to add <code>SUPABASE_SERVICE_ROLE_KEY</code> to the hub&apos;s settings.
      </Notice>
    );
  }

  const load = await loadGearBoard(createServiceClient(), {
    id: profile.id,
    isAdmin: isGearAdmin(profile),
  });
  if (load.status === "needs_migration") {
    return (
      <Notice title="Gear scan needs a database update">
        Run migration <code>200_gear_tags.sql</code> in Supabase, then refresh.
      </Notice>
    );
  }
  if (load.status === "error") {
    return <Notice title="Gear scan could not load">{load.message}</Notice>;
  }

  const sp = await searchParams;
  let initialProject = "";
  if (sp.project && /^[0-9a-f-]{36}$/i.test(sp.project)) {
    if (!load.board.projects.some((p) => p.id === sp.project)) {
      // Opened from an event checklist that is outside the usual date window.
      const { data } = await createServiceClient()
        .from("pipeline_projects")
        .select("id, name, project_date")
        .eq("id", sp.project)
        .maybeSingle();
      if (data) {
        load.board.projects.unshift({
          id: data.id as string,
          name: data.name as string,
          date: (data.project_date as string | null) ?? null,
        });
      }
    }
    if (load.board.projects.some((p) => p.id === sp.project)) initialProject = sp.project;
  }

  return (
    <GearScanClient
      board={load.board}
      initialTag={sp.tag ? (parseTagCode(sp.tag) ?? "") : ""}
      initialProjectId={initialProject}
    />
  );
}
