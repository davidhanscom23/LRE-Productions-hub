"use client";

import { useMemo, useState, useTransition } from "react";

import { mergeHoneyBookProjectsAction } from "@/app/(app)/honeybook/actions";
import { findSimilarProjects } from "@/lib/honeybook/duplicates";
import { formatHoneyBookStageLabel } from "@/lib/honeybook/pipeline-board";
import {
  formatHoneyBookMoney,
  projectBudgetNumber,
  type HoneyBookProject,
} from "@/lib/types/honeybook";

type FieldKey =
  | "name"
  | "client_id"
  | "project_type"
  | "project_date"
  | "budget"
  | "location"
  | "details";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "client_id", label: "Client" },
  { key: "project_type", label: "Type" },
  { key: "project_date", label: "Date" },
  { key: "budget", label: "Budget" },
  { key: "location", label: "Location" },
  { key: "details", label: "Details" },
];

function fieldText(p: HoneyBookProject, key: FieldKey): string {
  switch (key) {
    case "name":
      return p.name ?? "";
    case "client_id":
      return p.client_name || p.client_email || "";
    case "project_type":
      return p.project_type ?? "";
    case "project_date":
      return p.project_date ?? "";
    case "budget":
      return projectBudgetNumber(p.budget) > 0
        ? formatHoneyBookMoney(p.budget)
        : "";
    case "location":
      return p.location ?? "";
    case "details":
      return (p.details ?? "").trim();
  }
}

function fieldEmpty(p: HoneyBookProject, key: FieldKey): boolean {
  if (key === "client_id") return !p.client_id;
  if (key === "budget") return projectBudgetNumber(p.budget) <= 0;
  return fieldText(p, key).trim() === "";
}

function summary(p: HoneyBookProject): string {
  return [
    p.client_name || "No client",
    p.project_date || "no date",
    formatHoneyBookStageLabel(p.stage),
  ].join(" · ");
}

export function MergeProjectsDialog({
  source,
  candidates,
  initialOtherId,
  onClose,
  onMerged,
}: {
  /** The card the person opened "Merge" on. */
  source: HoneyBookProject;
  /** Every card that could be merged with it (open, not already merged). */
  candidates: HoneyBookProject[];
  /** Pre-select this card (used by the "Possible duplicate" badge). */
  initialOtherId?: string | null;
  onClose: () => void;
  /** Called with the id of the card that survived. */
  onMerged: (keptId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const others = candidates.filter((c) => c.id !== source.id);
    const likely = new Map(
      findSimilarProjects(source, others).map((m) => [m.id, m]),
    );
    return others
      .map((c) => ({ project: c, likely: likely.get(c.id) ?? null }))
      .sort((a, b) => {
        const as = a.likely?.score ?? -1;
        const bs = b.likely?.score ?? -1;
        if (as !== bs) return bs - as;
        return a.project.name.localeCompare(b.project.name);
      });
  }, [candidates, source]);

  const [otherId, setOtherId] = useState<string>(
    initialOtherId && options.some((o) => o.project.id === initialOtherId)
      ? initialOtherId
      : (options.find((o) => o.likely)?.project.id ?? ""),
  );
  const other = options.find((o) => o.project.id === otherId)?.project ?? null;

  /** Which of the two cards survives. Default: the one that already has a date. */
  const [keepSide, setKeepSide] = useState<"this" | "other" | null>(null);
  const [overrides, setOverrides] = useState<
    Partial<Record<FieldKey, "keep" | "merge">>
  >({});

  const defaultKeep: "this" | "other" =
    other && !source.project_date && other.project_date ? "other" : "this";
  const side = keepSide ?? defaultKeep;
  const kept = side === "this" ? source : other;
  const merged = side === "this" ? other : source;

  function choiceFor(key: FieldKey): "keep" | "merge" {
    const o = overrides[key];
    if (o) return o;
    if (kept && merged && fieldEmpty(kept, key) && !fieldEmpty(merged, key)) {
      return "merge";
    }
    return "keep";
  }

  function submit() {
    if (!kept || !merged) return;
    setError(null);
    const fields = FIELDS.filter((f) => choiceFor(f.key) === "merge").map(
      (f) => f.key,
    );
    startTransition(async () => {
      const r = await mergeHoneyBookProjectsAction({
        keepId: kept.id,
        mergeId: merged.id,
        fields,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      onMerged(kept.id);
    });
  }

  const radioBase =
    "flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-xs";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Merge cards"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:rounded-2xl sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          Merge duplicate cards
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Combine two cards that are the same event. The card you don’t keep is
          archived, not deleted.
        </p>

        <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs font-medium text-[var(--muted)]">This card</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {source.name}
          </p>
          <p className="text-xs text-[var(--muted)]">{summary(source)}</p>
        </div>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-[var(--muted)]">
            Merge it with
          </span>
          <select
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
            value={otherId}
            disabled={pending}
            onChange={(e) => {
              setOtherId(e.target.value);
              setKeepSide(null);
              setOverrides({});
            }}
          >
            <option value="">Choose a card…</option>
            {options.map(({ project, likely }) => (
              <option key={project.id} value={project.id}>
                {likely ? "Likely match: " : ""}
                {project.name} — {summary(project)}
              </option>
            ))}
          </select>
        </label>

        {other && kept && merged ? (
          <>
            <fieldset className="mt-4">
              <legend className="mb-1 text-sm text-[var(--muted)]">
                Which card do you want to keep?
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["this", source],
                    ["other", other],
                  ] as const
                ).map(([val, p]) => (
                  <label
                    key={val}
                    className={`${radioBase} ${
                      side === val
                        ? "border-[var(--brand)] bg-[var(--brand)]/10"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="keep-side"
                      className="mt-0.5"
                      checked={side === val}
                      disabled={pending}
                      onChange={() => {
                        setKeepSide(val);
                        setOverrides({});
                      }}
                    />
                    <span>
                      <span className="block font-semibold text-[var(--foreground)]">
                        {p.name}
                      </span>
                      <span className="text-[var(--muted)]">{summary(p)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-4">
              <p className="mb-1 text-sm text-[var(--muted)]">
                Details to keep on the merged card
              </p>
              <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {FIELDS.map((f) => {
                  const a = fieldText(kept, f.key);
                  const b = fieldText(merged, f.key);
                  if (!a && !b) return null;
                  const same = a.trim().toLowerCase() === b.trim().toLowerCase();
                  const choice = choiceFor(f.key);
                  return (
                    <div
                      key={f.key}
                      className="grid gap-1 p-2 sm:grid-cols-[88px_1fr_1fr] sm:items-start"
                    >
                      <span className="text-xs font-medium text-[var(--muted)]">
                        {f.label}
                      </span>
                      {same ? (
                        <span className="text-xs text-[var(--foreground)] sm:col-span-2">
                          {a || "—"}{" "}
                          <span className="text-[var(--muted)]">(same)</span>
                        </span>
                      ) : (
                        (
                          [
                            ["keep", a, "Kept card"],
                            ["merge", b, "Other card"],
                          ] as const
                        ).map(([val, text, who]) => (
                          <label
                            key={val}
                            className={`${radioBase} ${
                              choice === val
                                ? "border-[var(--brand)] bg-[var(--brand)]/10"
                                : "border-[var(--border)]"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`field-${f.key}`}
                              className="mt-0.5"
                              checked={choice === val}
                              disabled={pending}
                              onChange={() =>
                                setOverrides((o) => ({ ...o, [f.key]: val }))
                              }
                            />
                            <span className="min-w-0">
                              <span className="block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                                {who}
                              </span>
                              <span className="line-clamp-3 break-words text-[var(--foreground)]">
                                {text || "—"}
                              </span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-4 rounded-lg bg-[var(--background)] p-3 text-xs text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">
                “{merged.name}”
              </span>{" "}
              will be archived. Its notes, client files, payments, tasks, email
              threads and assigned staff move onto{" "}
              <span className="font-medium text-[var(--foreground)]">
                “{kept.name}”
              </span>
              . An admin can undo the merge from the archived card.
            </p>
          </>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            onClick={submit}
            disabled={pending || !other}
          >
            {pending ? "Merging…" : "Merge cards"}
          </button>
        </div>
      </div>
    </div>
  );
}
