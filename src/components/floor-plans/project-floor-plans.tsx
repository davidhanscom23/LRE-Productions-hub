"use client";

import {
  createFloorPlan,
  deleteFloorPlan,
  duplicateFloorPlan,
} from "@/app/(app)/floor-plans/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type FloorPlanListItem = {
  id: string;
  name: string;
  spaceName: string;
  status: string;
  updatedAt: string;
};
export type FloorPlanTemplateOption = { id: string; name: string };

const btn =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-40";

export function ProjectFloorPlans({
  projectId,
  plans,
  templates,
  canEdit,
}: {
  projectId: string;
  plans: FloorPlanListItem[];
  templates: FloorPlanTemplateOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = () =>
    start(async () => {
      setError(null);
      const res = await createFloorPlan({ projectId, templateId: templateId || null });
      if (res.error !== null) setError(res.error);
      else router.push(`/floor-plans/${res.id}`);
    });

  const duplicate = (id: string) =>
    start(async () => {
      const res = await duplicateFloorPlan(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  const remove = (id: string, name: string) => {
    if (!window.confirm(`Delete “${name}”? This can’t be undone.`)) return;
    start(async () => {
      const res = await deleteFloorPlan(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Floor plans</h2>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {templates.length > 0 && (
              <select
                className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                aria-label="Start from"
              >
                <option value="">Blank plan</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    Template: {t.name}
                  </option>
                ))}
              </select>
            )}
            <button className={btn} onClick={create} disabled={pending}>
              + New floor plan
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {plans.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">No floor plans for this project yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <a href={`/floor-plans/${p.id}`} className="text-sm font-medium underline-offset-2 hover:underline">
                  {p.name}
                </a>
                <p className="text-xs text-[var(--muted)]">
                  {p.spaceName ? `${p.spaceName} · ` : ""}
                  {p.status === "published" ? "Shared with client" : "Draft"} · edited{" "}
                  {new Date(p.updatedAt).toLocaleDateString("en-US")}
                </p>
              </div>
              <div className="flex gap-1.5">
                <a href={`/api/floor-plans/${p.id}/pdf`} target="_blank" rel="noreferrer" className={btn}>
                  PDF
                </a>
                {canEdit && (
                  <>
                    <button className={btn} onClick={() => duplicate(p.id)} disabled={pending}>
                      Duplicate
                    </button>
                    <button className={`${btn} text-red-600`} onClick={() => remove(p.id, p.name)} disabled={pending}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
