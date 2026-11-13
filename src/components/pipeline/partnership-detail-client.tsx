"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePipelineProjectAction } from "@/app/(app)/pipeline/actions";
import {
  savePartnershipFinancialsAction,
  updatePartnershipAction,
} from "@/app/(app)/pipeline/partnership-actions";
import {
  ManagerAssigneePicker,
  StaffAssignRequest,
  type StaffOption,
} from "@/components/pipeline/pipeline-assignees";
import { PartnershipMoney } from "@/components/pipeline/partnerships-panel";
import { ProjectNotes } from "@/components/pipeline/project-notes";
import {
  normalizePartnershipStage,
  PARTNER_KINDS,
  PARTNERSHIP_GOLD,
  PARTNERSHIP_STAGES,
} from "@/lib/pipeline/partnerships";
import { formatPipelineStageLabel } from "@/lib/pipeline/pipeline-board";
import type {
  PipelineProject,
  PipelineProjectNote,
  PipelineStageEvent,
  PartnershipFinancials,
} from "@/lib/types/pipeline";

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]";
const cardCls =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5";

export function PartnershipDetailClient({
  project,
  staffOptions,
  stageEvents,
  notes,
  financials,
  canManage,
  canAssign,
  canEdit,
  currentProfileId,
  isAdmin,
}: {
  project: PipelineProject;
  staffOptions: StaffOption[];
  stageEvents: PipelineStageEvent[];
  notes: PipelineProjectNote[];
  /** Only ever sent to admins. */
  financials: PartnershipFinancials | null;
  canManage: boolean;
  canAssign: boolean;
  canEdit: boolean;
  currentProfileId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <Link
        href="/pipeline?tab=partnerships"
        className="text-sm text-[var(--muted)] hover:underline"
      >
        ← Partnerships
      </Link>

      <div
        className={cardCls}
        style={{ borderLeft: `4px solid ${PARTNERSHIP_GOLD}` }}
      >
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black"
          style={{ backgroundColor: PARTNERSHIP_GOLD }}
        >
          Partnership · {project.partner_kind || "Other"}
        </span>
        <h1 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
          {project.name}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {normalizePartnershipStage(project.stage)}
          {project.location ? ` · ${project.location}` : ""}
        </p>
      </div>

      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Details</h2>
        {canEdit ? (
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              setSaved(null);
              startTransition(async () => {
                const r = await updatePartnershipAction({
                  id: project.id,
                  name: String(fd.get("name") ?? ""),
                  partnerKind: String(fd.get("kind") ?? ""),
                  stage: String(fd.get("stage") ?? ""),
                  location: String(fd.get("location") ?? ""),
                  details: String(fd.get("details") ?? ""),
                });
                if (r.error) setError(r.error);
                else {
                  setSaved("Saved.");
                  router.refresh();
                }
              });
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Name</span>
              <input
                name="name"
                required
                defaultValue={project.name}
                className={inputCls}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Type</span>
              <select
                name="kind"
                defaultValue={project.partner_kind || "Other"}
                className={inputCls}
              >
                {PARTNER_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Stage</span>
              <select
                name="stage"
                defaultValue={normalizePartnershipStage(project.stage)}
                className={inputCls}
              >
                {PARTNERSHIP_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">
                Location / website
              </span>
              <input
                name="location"
                defaultValue={project.location}
                className={inputCls}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">
                Contact and details
              </span>
              <textarea
                name="details"
                rows={4}
                defaultValue={project.details}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              {saved ? (
                <span className="text-sm text-[var(--brand)]">{saved}</span>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  disabled={pending}
                  className="ml-auto h-9 rounded-lg border border-red-300 px-3 text-sm text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
                  onClick={() => {
                    if (!confirm(`Delete partnership “${project.name}”?`)) return;
                    startTransition(async () => {
                      const r = await deletePipelineProjectAction({
                        id: project.id,
                      });
                      if (r.error) setError(r.error);
                      else router.push("/pipeline?tab=partnerships");
                    });
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <dl className="mt-3 space-y-1 text-sm">
            <div>
              <dt className="inline text-[var(--muted)]">Details: </dt>
              <dd className="inline whitespace-pre-wrap">
                {project.details || "—"}
              </dd>
            </div>
          </dl>
        )}
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </section>

      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Financials
        </h2>
        {isAdmin ? (
          <FinancialsForm project={project} financials={financials} />
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            <PartnershipMoney isAdmin={false} value={null} />{" "}
            <span className="ml-1">Visible to admins only.</span>
          </p>
        )}
      </section>

      <section className={cardCls}>
        {canAssign ? (
          <ManagerAssigneePicker project={project} staffOptions={staffOptions} />
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
            {(project.assignees ?? []).length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {(project.assignees ?? []).map((a) => (
                  <li key={a.profile_id}>
                    {a.role === "lead" ? "Lead · " : "Support · "}
                    {a.full_name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">Unassigned</p>
            )}
          </>
        )}
      </section>

      <ProjectNotes projectId={project.id} notes={notes} canEdit={canEdit} />

      {stageEvents.length > 0 ? (
        <section className={cardCls}>
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

function FinancialsForm({
  project,
  financials,
}: {
  project: PipelineProject;
  financials: PartnershipFinancials | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        startTransition(async () => {
          const r = await savePartnershipFinancialsAction({
            id: project.id,
            dealValue: String(fd.get("deal") ?? ""),
            financialNotes: String(fd.get("notes") ?? ""),
          });
          if (r.error) setMsg(r.error);
          else {
            setMsg("Saved.");
            router.refresh();
          }
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-[var(--muted)]">Deal value</span>
        <input
          name="deal"
          inputMode="decimal"
          defaultValue={financials?.dealValue ?? ""}
          className={inputCls}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">
          Financial notes (terms, rev share, fees)
        </span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={financials?.notes ?? ""}
          className={`${inputCls} h-auto py-2`}
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save financials"}
        </button>
        {msg ? <span className="text-sm text-[var(--muted)]">{msg}</span> : null}
      </div>
    </form>
  );
}
