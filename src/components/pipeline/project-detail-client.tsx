"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deletePipelineProjectAction,
  enableProjectShareAction,
  undoPipelineMergeAction,
  revokeProjectShareAction,
  updatePipelineProjectAction,
  updateProjectStageAction,
} from "@/app/(app)/pipeline/actions";
import {
  ManagerAssigneePicker,
  StaffAssignRequest,
  type StaffOption,
} from "@/components/pipeline/pipeline-assignees";
import { MergeProjectsDialog } from "@/components/pipeline/merge-projects-dialog";
import { ProjectFilesStaff } from "@/components/pipeline/project-files-staff";
import { ProjectNotes } from "@/components/pipeline/project-notes";
import {
  ProjectContracts,
  type ContractListItem,
  type ContractTemplateOption,
} from "@/components/project-contracts/project-contracts";
import {
  ProjectInvoices,
  type CatalogOption,
  type InvoiceListItem,
} from "@/components/project-invoices/project-invoices";
import { ProjectEmailComposer } from "@/components/pipeline/project-email-composer";
import { firstNameOf } from "@/lib/pipeline/project-email";
import {
  ProjectFloorPlans,
  type FloorPlanListItem,
  type FloorPlanTemplateOption,
} from "@/components/floor-plans/project-floor-plans";
import { ProjectQuestionnaireStaff } from "@/components/pipeline/project-questionnaire-staff";
import { PipelineSourceBadge } from "@/components/pipeline/source-badge";
import {
  formatPipelineStageLabel,
  pipelineStageMatchKey,
} from "@/lib/pipeline/pipeline-board";
import {
  formatPipelineMoney,
  PIPELINE_STAGE_HINTS,
  type PipelineClient,
  type PipelineProject,
  type PipelineProjectNote,
  type PipelineStageEvent,
} from "@/lib/types/pipeline";

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]";

export function ProjectDetailClient({
  project,
  clients,
  staffOptions,
  stageEvents,
  notes,
  packetLinks,
  canManage,
  canAssign,
  canEdit,
  currentProfileId,
  isAdmin = false,
  mergeCandidates = [],
  mergedIntoCard = null,
  floorPlans = [],
  floorPlanTemplates = [],
  invoices = [],
  catalogOptions = [],
  contracts = [],
  contractTemplates = [],
}: {
  project: PipelineProject;
  clients: PipelineClient[];
  staffOptions: StaffOption[];
  stageEvents: PipelineStageEvent[];
  notes: PipelineProjectNote[];
  packetLinks: { id: string; client_name: string; event_date: string }[];
  canManage: boolean;
  canAssign: boolean;
  canEdit: boolean;
  currentProfileId: string;
  isAdmin?: boolean;
  /** Open cards this one could be merged with (managers only). */
  mergeCandidates?: PipelineProject[];
  /** Set when this card was merged into another. */
  mergedIntoCard?: { id: string; name: string } | null;
  floorPlans?: FloorPlanListItem[];
  floorPlanTemplates?: FloorPlanTemplateOption[];
  invoices?: InvoiceListItem[];
  catalogOptions?: CatalogOption[];
  contracts?: ContractListItem[];
  contractTemplates?: ContractTemplateOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);

  const stageOptions = (() => {
    const byKey = new Map<string, string>();
    for (const h of PIPELINE_STAGE_HINTS) {
      byKey.set(pipelineStageMatchKey(h), h);
    }
    if (project.stage?.trim()) {
      const key = pipelineStageMatchKey(project.stage);
      if (!byKey.has(key)) byKey.set(key, project.stage.trim());
    }
    return Array.from(byKey.values()).sort((a, b) =>
      formatPipelineStageLabel(a).localeCompare(formatPipelineStageLabel(b)),
    );
  })();

  const stageValue =
    stageOptions.find(
      (s) =>
        pipelineStageMatchKey(s) === pipelineStageMatchKey(project.stage),
    ) ?? project.stage;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      {showMerge ? (
        <MergeProjectsDialog
          source={project}
          candidates={mergeCandidates}
          onClose={() => setShowMerge(false)}
          onMerged={(keptId) => {
            setShowMerge(false);
            if (keptId === project.id) router.refresh();
            else router.push(`/pipeline/projects/${keptId}`);
          }}
        />
      ) : null}
      {project.merged_into ? (
        <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 text-sm text-[var(--foreground)]">
          <p className="font-medium">This card was merged into another one and is archived.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {mergedIntoCard ? (
              <>
                Everything moved to{" "}
                <Link
                  href={`/pipeline/projects/${mergedIntoCard.id}`}
                  className="font-semibold text-[var(--brand)] hover:underline"
                >
                  {mergedIntoCard.name}
                </Link>
                .
              </>
            ) : (
              "Everything moved to the card it was merged into."
            )}
          </p>
          {isAdmin ? (
            <button
              type="button"
              disabled={pending}
              className="mt-2 h-8 rounded-lg border border-amber-500/60 px-3 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-50"
              onClick={() => {
                if (
                  !confirm(
                    "Undo this merge? The card comes back and its notes, files, payments and staff move back from the merged card.",
                  )
                )
                  return;
                startTransition(async () => {
                  const r = await undoPipelineMergeAction({ mergedId: project.id });
                  if (r.error) alert(r.error);
                  else router.refresh();
                });
              }}
            >
              Undo merge
            </button>
          ) : null}
        </div>
      ) : null}
      <div>
        <Link
          href="/pipeline?tab=projects"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back to Projects
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {project.client_name || "No client"}
              {project.client_email ? ` · ${project.client_email}` : ""}
              <PipelineSourceBadge
                sourceEvent={project.source_event}
                className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              />
              {!canEdit ? (
                <span className="ml-1 text-[10px] text-[var(--muted)]">
                  View only
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <select
                className={`${inputCls} w-auto min-w-[140px]`}
                value={stageValue || ""}
                disabled={pending}
                aria-label="Stage"
                onChange={(e) => {
                  const stage = e.target.value;
                  startTransition(async () => {
                    const r = await updateProjectStageAction({
                      id: project.id,
                      stage,
                    });
                    if (r.error) alert(r.error);
                    else router.refresh();
                  });
                }}
              >
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {formatPipelineStageLabel(s)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
                {formatPipelineStageLabel(project.stage) || "—"}
              </span>
            )}
            {canEdit ? (
              <button
                type="button"
                className="h-9 rounded-lg px-3 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)]/10"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await enableProjectShareAction({
                      id: project.id,
                    });
                    if (r.error) {
                      alert(r.error);
                      return;
                    }
                    const path =
                      r.path ?? (r.token ? `/project/${r.token}` : null);
                    if (path) {
                      const url = `${window.location.origin}${path}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        alert(`Client link copied:\n${url}`);
                      } catch {
                        prompt("Copy client link", url);
                      }
                    }
                    router.refresh();
                  });
                }}
              >
                {project.share_enabled ? "Copy client link" : "Share link"}
              </button>
            ) : null}
            {canEdit && project.share_enabled ? (
              <button
                type="button"
                className="h-9 rounded-lg px-3 text-sm text-[var(--muted)] hover:bg-[var(--background)]"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await revokeProjectShareAction({
                      id: project.id,
                    });
                    if (r.error) alert(r.error);
                    else router.refresh();
                  });
                }}
              >
                Stop sharing
              </button>
            ) : null}
            {canManage && !project.merged_into ? (
              <button
                type="button"
                className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                disabled={pending}
                onClick={() => setShowMerge(true)}
              >
                Merge with…
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="h-9 rounded-lg px-3 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Delete project “${project.name}”?`)) return;
                  startTransition(async () => {
                    const r = await deletePipelineProjectAction({
                      id: project.id,
                    });
                    if (r.error) alert(r.error);
                    else router.push("/pipeline?tab=projects");
                  });
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {canEdit ? "Edit project" : "Project details"}
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Changes here stay in the Hub. Pipeline has no public API, so stage
          and other fields do not sync back to Pipeline.
        </p>
        {canEdit ? (
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setFormError(null);
              startTransition(async () => {
                const r = await updatePipelineProjectAction({
                  id: project.id,
                  name: String(fd.get("name") ?? ""),
                  stage: String(fd.get("stage") ?? ""),
                  clientId: String(fd.get("client_id") ?? "") || null,
                  projectType: String(fd.get("project_type") ?? ""),
                  projectDate: String(fd.get("project_date") ?? "") || null,
                  location: String(fd.get("location") ?? ""),
                  details: String(fd.get("details") ?? ""),
                  budget: String(fd.get("budget") ?? "") || null,
                });
                if (r.error) {
                  setFormError(r.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">Name</span>
              <input
                name="name"
                required
                defaultValue={project.name}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Stage</span>
              <select
                name="stage"
                className={inputCls}
                defaultValue={stageValue || "Inquiry"}
              >
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {formatPipelineStageLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Client</span>
              <select
                name="client_id"
                className={inputCls}
                defaultValue={project.client_id ?? ""}
              >
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email || c.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Type</span>
              <input
                name="project_type"
                defaultValue={project.project_type}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Date</span>
              <input
                name="project_date"
                type="date"
                defaultValue={project.project_date ?? ""}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Location</span>
              <input
                name="location"
                defaultValue={project.location}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Budget</span>
              <input
                name="budget"
                inputMode="decimal"
                defaultValue={
                  project.budget != null && project.budget !== ""
                    ? String(project.budget)
                    : ""
                }
                className={inputCls}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">Details</span>
              <textarea
                name="details"
                rows={4}
                defaultValue={project.details}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            {formError ? (
              <p className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
                {formError}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs text-[var(--muted)]">Stage</dt>
              <dd>{formatPipelineStageLabel(project.stage) || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Type / date / location</dt>
              <dd>
                {[
                  project.project_type || null,
                  project.project_date || null,
                  project.location || null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
            {project.budget != null && project.budget !== "" ? (
              <div>
                <dt className="text-xs text-[var(--muted)]">Budget</dt>
                <dd>{formatPipelineMoney(project.budget)}</dd>
              </div>
            ) : null}
            {project.details?.trim() ? (
              <div>
                <dt className="text-xs text-[var(--muted)]">Details</dt>
                <dd className="whitespace-pre-wrap">{project.details}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        {canAssign ? (
          <ManagerAssigneePicker
            project={project}
            staffOptions={staffOptions}
          />
        ) : canEdit ? (
          <StaffAssignRequest
            project={project}
            staffOptions={staffOptions}
            currentProfileId={currentProfileId}
          />
        ) : (
          <>
            <p className="text-xs font-medium text-[var(--muted)]">
              Assigned staff
            </p>
            <div className="mt-2">
              {(project.assignees ?? []).length ? (
                <ul className="space-y-1 text-sm">
                  {(project.assignees ?? []).map((a) => (
                    <li key={a.profile_id}>
                      {a.role === "lead" ? "Lead · " : "Support · "}
                      {a.full_name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">Unassigned</p>
              )}
            </div>
          </>
        )}
      </section>

      <ProjectNotes projectId={project.id} notes={notes} canEdit={canEdit} />

      <ProjectEmailComposer
        projectId={project.id}
        clientEmail={project.client_email ?? ""}
        canSend={canEdit || canManage}
        ctx={{
          firstName: firstNameOf(project.client_name),
          projectName: project.name,
          eventDate: project.project_date
            ? new Intl.DateTimeFormat("en-US", {
                timeZone: "UTC",
                month: "long",
                day: "numeric",
                year: "numeric",
              }).format(new Date(`${project.project_date}T00:00:00Z`))
            : "",
          location: project.location ?? "",
          senderName:
            staffOptions.find((x) => x.id === currentProfileId)?.full_name ?? "",
          projectLink:
            project.share_enabled && project.share_token
              ? `https://hub.lreproductions.com/project/${project.share_token}`
              : "",
        }}
      />


      <ProjectContracts
        projectId={project.id}
        clientEmail={project.client_email ?? ""}
        contracts={contracts}
        templates={contractTemplates}
        canManage={canManage}
      />

      <ProjectInvoices
        projectId={project.id}
        clientEmail={project.client_email ?? ""}
        eventDate={project.project_date ?? null}
        invoices={invoices}
        catalog={catalogOptions}
        canManage={canManage}
      />

      <ProjectFloorPlans
        projectId={project.id}
        plans={floorPlans}
        templates={floorPlanTemplates}
        canEdit={canEdit || canManage}
      />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Client submissions
        </h2>
        <ProjectQuestionnaireStaff
          answers={project.questionnaire?.answers}
          submittedAt={project.questionnaire?.submitted_at}
        />
        <ProjectFilesStaff
          files={project.files ?? []}
          canEdit={canEdit || canManage}
        />
        {!project.questionnaire?.answers &&
        !(project.files ?? []).length ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No client questionnaire answers or files yet.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Gear checklist</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Check gear out of and back into the warehouse for this event.
        </p>
        <Link
          href={`/event-checklist/${project.id}`}
          className="mt-3 inline-flex rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Open gear checklist
        </Link>
      </section>

      {packetLinks.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Event packets
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {packetLinks.map((pkt) => (
              <li key={pkt.id}>
                <Link
                  href={`/event-packets/${pkt.id}`}
                  className="font-medium text-[var(--brand)] hover:underline"
                >
                  {pkt.client_name || "Packet"} ({pkt.event_date})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stageEvents.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Stage history
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
            {stageEvents.map((ev) => (
              <li key={ev.id}>
                {ev.from_stage
                  ? `${formatPipelineStageLabel(ev.from_stage)} → ${formatPipelineStageLabel(ev.to_stage)}`
                  : `Set to ${formatPipelineStageLabel(ev.to_stage)}`}
                {ev.changer_name ? ` · ${ev.changer_name}` : ""}
                {" · "}
                {new Date(ev.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
