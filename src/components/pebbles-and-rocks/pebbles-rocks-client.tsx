"use client";

import { useMemo, useState } from "react";
import { Mountain, Circle, Plus, Target, Trash2, X } from "lucide-react";
import {
  GOAL_STATUS_CYCLE,
  GOAL_STATUS_LABELS,
  type GoalKind,
  type GoalStatus,
  type QuarterlyGoal,
} from "@/lib/types/quarterly-goals";
import {
  createGoalAction,
  deleteGoalAction,
  setGoalStatusAction,
} from "@/app/(app)/pebbles-and-rocks/actions";

type Person = { id: string; name: string };

type Props = {
  people: Person[];
  goals: QuarterlyGoal[];
  currentUserId: string;
  isAdmin: boolean;
  readOnly: boolean;
  currentYear: number;
};

const QUARTERS = [1, 2, 3, 4];

const STATUS_STYLE: Record<GoalStatus, string> = {
  not_started: "bg-[var(--surface-hover)] text-[var(--muted)]",
  on_track: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  done: "bg-[var(--brand-soft)] text-[var(--brand)]",
};

export function PebblesRocksClient({
  people,
  goals,
  currentUserId,
  isAdmin,
  readOnly,
  currentYear,
}: Props) {
  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    goals.forEach((g) => set.add(g.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [goals, currentYear]);

  const [year, setYear] = useState(currentYear);
  const [scope, setScope] = useState<string>(
    isAdmin ? "everyone" : currentUserId,
  );
  const [adding, setAdding] = useState<null | {
    userId: string;
    quarter: number;
    kind: GoalKind;
  }>(null);

  const visiblePeople = useMemo(() => {
    if (scope === "everyone") return people;
    const p = people.find((x) => x.id === scope);
    return p ? [p] : [];
  }, [scope, people]);

  function canEdit(personId: string) {
    return !readOnly && (isAdmin || personId === currentUserId);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Target className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Pebbles &amp; Rocks
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Quarterly priorities. Rocks are the big goals; pebbles are the
            supporting steps.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--foreground)]"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">Board</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--foreground)]"
          >
            <option value="everyone">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === currentUserId ? `${p.name} (me)` : p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visiblePeople.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No one to show.</p>
      ) : (
        visiblePeople.map((person) => (
          <PersonBoard
            key={person.id}
            person={person}
            year={year}
            goals={goals.filter(
              (g) => g.user_id === person.id && g.year === year,
            )}
            editable={canEdit(person.id)}
            onAdd={(quarter, kind) =>
              setAdding({ userId: person.id, quarter, kind })
            }
          />
        ))
      )}

      {adding ? (
        <AddGoalModal
          userId={adding.userId}
          quarter={adding.quarter}
          kind={adding.kind}
          year={year}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </div>
  );
}

function PersonBoard({
  person,
  year,
  goals,
  editable,
  onAdd,
}: {
  person: Person;
  year: number;
  goals: QuarterlyGoal[];
  editable: boolean;
  onAdd: (quarter: number, kind: GoalKind) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        {person.name}
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {QUARTERS.map((q) => {
          const rocks = goals.filter(
            (g) => g.quarter === q && g.kind === "rock",
          );
          const pebbles = goals.filter(
            (g) => g.quarter === q && g.kind === "pebble",
          );
          return (
            <div
              key={q}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Q{q} {year}
              </p>

              <GoalGroup
                icon={<Mountain className="h-3.5 w-3.5" />}
                label="Rocks"
                goals={rocks}
                editable={editable}
                onAdd={() => onAdd(q, "rock")}
              />
              <GoalGroup
                icon={<Circle className="h-3.5 w-3.5" />}
                label="Pebbles"
                goals={pebbles}
                editable={editable}
                onAdd={() => onAdd(q, "pebble")}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GoalGroup({
  icon,
  label,
  goals,
  editable,
  onAdd,
}: {
  icon: React.ReactNode;
  label: string;
  goals: QuarterlyGoal[];
  editable: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {icon}
          {label}
        </span>
        {editable ? (
          <button
            type="button"
            onClick={onAdd}
            className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--brand)]"
            aria-label={`Add ${label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {goals.length === 0 ? (
        <p className="mt-1 text-xs text-[var(--muted)]">—</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {goals.map((g) => (
            <GoalItem key={g.id} goal={g} editable={editable} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GoalItem({
  goal,
  editable,
}: {
  goal: QuarterlyGoal;
  editable: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function cycleStatus() {
    if (!editable || busy) return;
    const idx = GOAL_STATUS_CYCLE.indexOf(goal.status);
    const next = GOAL_STATUS_CYCLE[(idx + 1) % GOAL_STATUS_CYCLE.length];
    setBusy(true);
    await setGoalStatusAction(goal.id, next);
    setBusy(false);
  }

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {goal.title}
        </p>
        {editable ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Delete this item?")) return;
              setBusy(true);
              await deleteGoalAction(goal.id);
              setBusy(false);
            }}
            className="rounded p-0.5 text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {goal.detail ? (
        <p className="mt-0.5 text-xs text-[var(--muted)]">{goal.detail}</p>
      ) : null}
      <button
        type="button"
        onClick={cycleStatus}
        disabled={!editable || busy}
        className={[
          "mt-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          STATUS_STYLE[goal.status],
          editable ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
        title={editable ? "Click to change status" : undefined}
      >
        {GOAL_STATUS_LABELS[goal.status]}
      </button>
    </li>
  );
}

function AddGoalModal({
  userId,
  quarter,
  kind,
  year,
  onClose,
}: {
  userId: string;
  quarter: number;
  kind: GoalKind;
  year: number;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    formData.set("user_id", userId);
    formData.set("quarter", String(quarter));
    formData.set("year", String(year));
    formData.set("kind", kind);
    const res = await createGoalAction(formData);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Add {kind === "rock" ? "Rock" : "Pebble"} · Q{quarter} {year}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--foreground)]">
              Title <span className="text-red-600">*</span>
            </span>
            <input
              name="title"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--foreground)]">
              Detail (optional)
            </span>
            <textarea
              name="detail"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
