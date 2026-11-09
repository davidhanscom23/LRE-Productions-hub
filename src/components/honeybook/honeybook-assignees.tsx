"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  requestProjectAssignmentAction,
  reviewAssignmentRequestAction,
  setProjectAssigneesAction,
} from "@/app/(app)/honeybook/actions";
import { colorSoftBackground, staffChipStyle } from "@/lib/people/color";
import type {
  HoneyBookAssignmentRequest,
  HoneyBookAssigneeRole,
  HoneyBookProject,
  HoneyBookProjectAssignee,
} from "@/lib/types/honeybook";

export type StaffOption = {
  id: string;
  full_name: string;
  email: string;
  color: string | null;
};

function sortAssignees(list: HoneyBookProjectAssignee[]) {
  return [...list].sort((a, b) => {
    const ar = a.role === "lead" ? 0 : 1;
    const br = b.role === "lead" ? 0 : 1;
    if (ar !== br) return ar - br;
    return (a.full_name || "").localeCompare(b.full_name || "");
  });
}

export function AssigneeChips({
  assignees,
}: {
  assignees: HoneyBookProjectAssignee[];
}) {
  if (!assignees.length) {
    return (
      <p className="mt-1 text-[11px] text-[var(--muted)]">Unassigned</p>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {sortAssignees(assignees).map((a) => (
        <span
          key={a.profile_id}
          className="inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            ...staffChipStyle(a.color),
            borderColor: a.color ?? "var(--border)",
          }}
          title={
            a.role === "lead"
              ? `${a.full_name} (project lead)`
              : `${a.full_name} (support)`
          }
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: a.color ?? "var(--muted)" }}
          />
          <span className="truncate">
            {a.role === "lead" ? "Lead · " : ""}
            {a.full_name.split(/\s+/)[0]}
          </span>
        </span>
      ))}
    </div>
  );
}

export function projectCardStyle(assignees: HoneyBookProjectAssignee[] | undefined) {
  const primary =
    assignees?.find((a) => a.role === "lead") ?? assignees?.[0];
  if (!primary?.color) {
    return {
      borderLeftWidth: undefined as string | undefined,
      borderLeftColor: undefined as string | undefined,
      backgroundColor: undefined as string | undefined,
    };
  }
  return {
    borderLeftWidth: "3px",
    borderLeftColor: primary.color,
    backgroundColor: colorSoftBackground(primary.color, 0.14),
  };
}

function saveAssignees(
  projectId: string,
  assignees: { profileId: string; role: HoneyBookAssigneeRole }[],
  startTransition: ReturnType<typeof useTransition>[1],
  router: ReturnType<typeof useRouter>,
) {
  startTransition(async () => {
    const r = await setProjectAssigneesAction({ projectId, assignees });
    if (r.error) alert(r.error);
    else router.refresh();
  });
}

function currentAssigneePayload(project: HoneyBookProject) {
  return (project.assignees ?? []).map((a) => ({
    profileId: a.profile_id,
    role: (a.role === "lead" ? "lead" : "support") as HoneyBookAssigneeRole,
  }));
}

/** Admin multi-assign with one project lead + support staff. */
export function ManagerAssigneePicker({
  project,
  staffOptions,
  compact = false,
}: {
  project: HoneyBookProject;
  staffOptions: StaffOption[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const leadId =
    project.assignees?.find((a) => a.role === "lead")?.profile_id ?? "";
  const supportIds = new Set(
    (project.assignees ?? [])
      .filter((a) => a.role !== "lead")
      .map((a) => a.profile_id),
  );
  const supportAvailable = staffOptions.filter(
    (s) => s.id !== leadId && !supportIds.has(s.id),
  );

  function setLead(nextLeadId: string) {
    const next: { profileId: string; role: HoneyBookAssigneeRole }[] = [];
    if (nextLeadId) next.push({ profileId: nextLeadId, role: "lead" });
    for (const a of project.assignees ?? []) {
      if (a.profile_id === nextLeadId) continue;
      if (a.role === "lead") continue;
      next.push({ profileId: a.profile_id, role: "support" });
    }
    saveAssignees(project.id, next, startTransition, router);
  }

  function addSupport(profileId: string) {
    const next = currentAssigneePayload(project).filter(
      (a) => a.profileId !== profileId,
    );
    if (leadId === profileId) {
      // Promoting from empty lead path shouldn't happen via support select.
      next.push({ profileId, role: "lead" });
    } else {
      next.push({ profileId, role: "support" });
    }
    saveAssignees(project.id, next, startTransition, router);
  }

  function removePerson(profileId: string) {
    const next = currentAssigneePayload(project).filter(
      (a) => a.profileId !== profileId,
    );
    saveAssignees(project.id, next, startTransition, router);
  }

  if (compact) {
    return (
      <div className="mt-2 space-y-1.5">
        <AssigneeChips assignees={project.assignees ?? []} />
        <select
          className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
          disabled={pending}
          value={leadId}
          aria-label={`Project lead for ${project.name}`}
          onChange={(e) => setLead(e.target.value)}
        >
          <option value="">Project lead…</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.email}
            </option>
          ))}
        </select>
        <select
          className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
          disabled={pending || supportAvailable.length === 0}
          value=""
          aria-label={`Add support staff to ${project.name}`}
          onChange={(e) => {
            const id = e.target.value;
            if (id) addSupport(id);
          }}
        >
          <option value="">
            {supportAvailable.length ? "Add support…" : "No more support"}
          </option>
          {supportAvailable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.email}
            </option>
          ))}
        </select>
        {(project.assignees ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sortAssignees(project.assignees ?? []).map((a) => (
              <button
                key={a.profile_id}
                type="button"
                disabled={pending}
                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                title={`Remove ${a.full_name}`}
                onClick={() => removePerson(a.profile_id)}
              >
                Remove {a.full_name.split(/\s+/)[0]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-xs font-medium text-[var(--muted)]">Project lead</p>
      <select
        className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
        disabled={pending}
        value={leadId}
        onChange={(e) => setLead(e.target.value)}
      >
        <option value="">— None —</option>
        {staffOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name || s.email}
          </option>
        ))}
      </select>

      <p className="mt-4 text-xs font-medium text-[var(--muted)]">
        Support staff
      </p>
      <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
        {staffOptions
          .filter((s) => s.id !== leadId)
          .map((s) => {
            const checked = supportIds.has(s.id);
            return (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-[var(--background)]"
              >
                <input
                  type="checkbox"
                  className="rounded border-[var(--border)]"
                  checked={checked}
                  disabled={pending}
                  onChange={() => {
                    if (checked) removePerson(s.id);
                    else addSupport(s.id);
                  }}
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color ?? "var(--muted)" }}
                />
                <span className="truncate text-[var(--foreground)]">
                  {s.full_name || s.email}
                </span>
              </label>
            );
          })}
      </div>
    </div>
  );
}

export function StaffAssignRequest({
  project,
  staffOptions,
  currentProfileId,
}: {
  project: HoneyBookProject;
  staffOptions: StaffOption[];
  currentProfileId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const assigned = new Set((project.assignees ?? []).map((a) => a.profile_id));
  const others = staffOptions.filter((s) => s.id !== currentProfileId);

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-xs font-medium text-[var(--muted)]">
        Request to add support (admin approves)
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          className="h-9 min-w-[180px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
          defaultValue=""
          disabled={pending}
          id={`req-add-${project.id}`}
        >
          <option value="">Pick teammate…</option>
          {others
            .filter((s) => !assigned.has(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name || s.email}
              </option>
            ))}
        </select>
        <button
          type="button"
          disabled={pending}
          className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => {
            const el = document.getElementById(
              `req-add-${project.id}`,
            ) as HTMLSelectElement | null;
            const target = el?.value ?? "";
            if (!target) return;
            startTransition(async () => {
              const r = await requestProjectAssignmentAction({
                projectId: project.id,
                targetProfileId: target,
                action: "add",
              });
              if (r.error) alert(r.error);
              else {
                alert(
                  r.pendingApproval
                    ? "Sent to admin for approval."
                    : "Updated.",
                );
                router.refresh();
              }
            });
          }}
        >
          Request add
        </button>
      </div>
      {assigned.has(currentProfileId) ? (
        <button
          type="button"
          disabled={pending}
          className="mt-2 text-xs text-[var(--muted)] underline"
          onClick={() => {
            startTransition(async () => {
              const r = await requestProjectAssignmentAction({
                projectId: project.id,
                targetProfileId: currentProfileId,
                action: "remove",
              });
              if (r.error) alert(r.error);
              else router.refresh();
            });
          }}
        >
          Remove myself
        </button>
      ) : null}
    </div>
  );
}

export function PendingAssignmentPanel({
  requests,
  isAdmin,
}: {
  requests: HoneyBookAssignmentRequest[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!isAdmin || requests.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Assignment requests ({requests.length})
      </h2>
      <ul className="mt-3 space-y-3">
        {requests.map((req) => (
          <li
            key={req.id}
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <p className="font-medium text-[var(--foreground)]">
                {req.requester_name || "Staff"} wants to {req.action}{" "}
                {req.target_name || "someone"} on{" "}
                {req.project_name || "a project"}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(req.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                className="h-8 rounded-lg bg-emerald-700 px-3 text-xs font-medium text-white disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    const r = await reviewAssignmentRequestAction({
                      requestId: req.id,
                      decision: "approved",
                    });
                    if (r.error) alert(r.error);
                    else router.refresh();
                  });
                }}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                className="h-8 rounded-lg border border-[var(--border)] px-3 text-xs disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    const r = await reviewAssignmentRequestAction({
                      requestId: req.id,
                      decision: "denied",
                    });
                    if (r.error) alert(r.error);
                    else router.refresh();
                  });
                }}
              >
                Deny
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
