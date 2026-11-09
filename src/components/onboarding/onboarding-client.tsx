"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addItemAction,
  createPlanAction,
  deleteItemAction,
  deletePlanAction,
  setPlanStatusAction,
  toggleItemAction,
} from "@/app/(app)/onboarding/actions";
import {
  ONBOARDING_CATEGORIES,
  type OnboardingCategory,
  type OnboardingItem,
  type OnboardingPlan,
} from "@/lib/types/onboarding";
import type { StaffOption } from "@/lib/types/action-items";

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PlanCard({
  plan,
  staff,
  isAdmin,
}: {
  plan: OnboardingPlan;
  staff: StaffOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(!isAdmin);
  const [newLabel, setNewLabel] = useState("");
  const [newCat, setNewCat] = useState<OnboardingCategory>("other");

  const done = plan.items.filter((i) => i.is_done).length;
  const total = plan.items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function toggle(item: OnboardingItem) {
    startTransition(async () => {
      const r = await toggleItemAction({ id: item.id, done: !item.is_done });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function addItem() {
    if (!newLabel.trim()) return;
    startTransition(async () => {
      const r = await addItemAction({
        planId: plan.id,
        label: newLabel,
        category: newCat,
        sortOrder: (plan.items.at(-1)?.sort_order ?? 0) + 1,
      });
      if (r.error) { alert(r.error); return; }
      setNewLabel("");
      router.refresh();
    });
  }
  function removeItem(id: string) {
    startTransition(async () => {
      const r = await deleteItemAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function setStatus(status: "active" | "complete" | "archived") {
    startTransition(async () => {
      await setPlanStatusAction({ planId: plan.id, status });
      router.refresh();
    });
  }
  function removePlan() {
    if (!confirm(`Delete onboarding for ${plan.subject_name}?`)) return;
    startTransition(async () => {
      const r = await deletePlanAction(plan.id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  const grouped = ONBOARDING_CATEGORIES.map((c) => ({
    category: c,
    items: plan.items.filter((i) => i.category === c.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {plan.subject_name}
            {plan.role_title ? <span className="font-normal text-[var(--muted)]"> · {plan.role_title}</span> : null}
            {plan.status !== "active" ? <span className="ml-2 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] capitalize text-[var(--muted)]">{plan.status}</span> : null}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {plan.start_date ? `Starts ${fmtDate(plan.start_date)} · ` : ""}{done}/{total} done
          </p>
        </div>
        <div className="flex w-40 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-medium text-[var(--muted)]">{pct}%</span>
        </div>
      </button>

      {open ? (
        <div className="mt-3 space-y-4 border-t border-[var(--border)] pt-3">
          {grouped.map((g) => (
            <div key={g.category.value}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {g.category.label}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {g.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggle(item)}
                      aria-label={item.is_done ? "Mark not done" : "Mark done"}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${item.is_done ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border)] hover:border-[var(--brand)]"}`}
                    >
                      {item.is_done ? "✓" : ""}
                    </button>
                    <span className={`flex-1 text-sm ${item.is_done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>
                      {item.label}
                    </span>
                    {isAdmin ? (
                      <button type="button" onClick={() => removeItem(item.id)} className="text-xs text-[var(--muted)] hover:text-red-600">×</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Add custom item */}
          {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Add a task…" className={`${inputCls} flex-1`} />
            <select value={newCat} onChange={(e) => setNewCat(e.target.value as OnboardingCategory)} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]">
              {ONBOARDING_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
            <button type="button" disabled={pending || !newLabel.trim()} onClick={addItem} className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50">Add</button>
          </div>
          ) : null}

          {isAdmin ? (
          <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-3 text-xs">
            {plan.status !== "complete" ? (
              <button type="button" onClick={() => setStatus("complete")} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">Mark complete</button>
            ) : (
              <button type="button" onClick={() => setStatus("active")} className="font-medium text-[var(--brand)] hover:underline">Reopen</button>
            )}
            {plan.status !== "archived" ? (
              <button type="button" onClick={() => setStatus("archived")} className="text-[var(--muted)] hover:text-[var(--foreground)]">Archive</button>
            ) : null}
            <button type="button" onClick={removePlan} className="text-[var(--muted)] hover:text-red-600">Delete</button>
          </div>
          ) : null}
          {staff.length > 0 && plan.profile_id ? (
            <p className="text-xs text-[var(--muted)]">
              Linked to {staff.find((s) => s.id === plan.profile_id)?.full_name ?? "a profile"}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function OnboardingClient({
  plans,
  staff,
  isAdmin = true,
}: {
  plans: OnboardingPlan[];
  staff: StaffOption[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = plans.filter((p) =>
    showArchived ? true : p.status !== "archived",
  );

  function create() {
    setError(null);
    startTransition(async () => {
      const r = await createPlanAction({
        subjectName: name,
        profileId: profileId || null,
        roleTitle,
        startDate,
      });
      if (r.error) { setError(r.error); return; }
      setName(""); setProfileId(""); setRoleTitle(""); setStartDate("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Onboarding
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {isAdmin
            ? "Set up a new hire with a standard checklist and track them to a productive Day 1. Hiring a candidate with an email also invites them to the Hub."
            : "Check off your new-hire setup tasks. Admins manage the full checklist."}
        </p>
      </header>

      {isAdmin ? (
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Start an onboarding</h2>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New hire name" className={`${inputCls} flex-1`} />
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Role / title" className={`${inputCls} flex-1`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={`${inputCls} flex-1`}>
              <option value="">Link to existing profile (optional)</option>
              {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
            </select>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <button type="button" disabled={pending || !name.trim()} onClick={create} className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          Create with standard checklist
        </button>
      </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {isAdmin ? "Onboarding plans" : "Your checklist"}
          </h2>
          {isAdmin ? (
          <button type="button" onClick={() => setShowArchived((s) => !s)} className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          ) : null}
        </div>
        {visible.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No onboarding plans yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {visible.map((p) => (
              <PlanCard key={p.id} plan={p} staff={staff} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
