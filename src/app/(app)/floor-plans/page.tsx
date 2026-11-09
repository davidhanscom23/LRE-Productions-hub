import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessHoneyBook, canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewTemplateButton } from "@/components/floor-plans/new-template-button";

export default async function FloorPlansPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessHoneyBook(profile.role)) redirect("/");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("floor_plans")
    .select("id, name, space_name, is_template, status, updated_at, project_id, honeybook_projects:project_id ( name )")
    .order("updated_at", { ascending: false })
    .limit(300);

  type Row = {
    id: string;
    name: string;
    space_name: string;
    is_template: boolean;
    status: string;
    updated_at: string;
    project_id: string | null;
    honeybook_projects: { name: string } | { name: string }[] | null;
  };
  const all = (rows ?? []) as unknown as Row[];
  const templates = all.filter((r) => r.is_template);
  const plans = all.filter((r) => !r.is_template);
  const projectName = (r: Row) =>
    (Array.isArray(r.honeybook_projects) ? r.honeybook_projects[0] : r.honeybook_projects)?.name ?? "Project";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Floor plans</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Lay out a room with tables, stage and AV gear. Open a project card to start a plan for a client, or build a reusable template here.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Templates</h2>
          {canManageHoneyBookCrm(profile.role) && <NewTemplateButton />}
        </div>
        {templates.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No templates yet. Build one, or save any project plan as a template.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {templates.map((t) => (
              <li key={t.id} className="py-2">
                <a className="font-medium hover:underline" href={`/floor-plans/${t.id}`}>{t.name}</a>
                {t.space_name ? <span className="text-[var(--muted)]"> · {t.space_name}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">Project plans</h2>
        {plans.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No project floor plans yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <a className="font-medium hover:underline" href={`/floor-plans/${p.id}`}>{p.name}</a>
                  <p className="text-xs text-[var(--muted)]">
                    {projectName(p)} · {p.status === "published" ? "Shared with client" : "Draft"} · edited{" "}
                    {new Date(p.updated_at).toLocaleDateString("en-US")}
                  </p>
                </div>
                {p.project_id && (
                  <a className="text-xs underline" href={`/honeybook/projects/${p.project_id}`}>Open project</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
