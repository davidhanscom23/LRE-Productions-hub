"use client";

import type { Department, Profile } from "@/lib/types/database";
import {
  ORG_CHART_DEPARTMENTS,
  buildDepartmentOrgForest,
  profilesInDepartment,
  type OrgNode,
} from "@/lib/people/org-chart";
import { ROLE_LABELS } from "@/lib/types/database";

type OrgChartPanelProps = {
  profiles: Profile[];
  departmentManagers?: import("@/lib/types/department-managers").DepartmentManagerMap;
  isAdmin: boolean;
  onEdit: (profile: Profile) => void;
};

export function OrgChartPanel({
  profiles,
  departmentManagers = {},
  isAdmin,
  onEdit,
}: OrgChartPanelProps) {
  const active = profiles.filter((p) => p.is_active);
  const unassigned = active.filter((p) => p.departments.length === 0);

  if (active.length === 0) {
    return (
      <Empty
        title="No people yet"
        body="Invite staff and they’ll appear here once active."
      />
    );
  }

  return (
    <div className="mt-5 space-y-8">
      <p className="text-sm text-[var(--muted)]">
        Split by department. People with multiple departments appear in each
        chart, and can report to a different manager in each one
        {isAdmin
          ? " — edit anyone to set departments and per-department managers."
          : "."}
      </p>

      {ORG_CHART_DEPARTMENTS.map((department) => {
        const members = profilesInDepartment(active, department);
        const forest = buildDepartmentOrgForest(
          active,
          department,
          departmentManagers,
        );
        return (
          <DepartmentSection
            key={department}
            department={department}
            count={members.length}
            forest={forest}
            isAdmin={isAdmin}
            onEdit={onEdit}
          />
        );
      })}

      {unassigned.length > 0 ? (
        <section className="space-y-3">
          <header className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              No department
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {unassigned.length}{" "}
              {unassigned.length === 1 ? "person" : "people"}
            </span>
          </header>
          <p className="text-sm text-[var(--muted)]">
            Assign one or more departments on their profile to place them in a
            chart above.
          </p>
          <ul className="space-y-2">
            {unassigned
              .slice()
              .sort((a, b) =>
                (a.full_name || a.email).localeCompare(b.full_name || b.email),
              )
              .map((profile) => (
                <OrgPersonRow
                  key={profile.id}
                  profile={profile}
                  depth={0}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                  showDepartments={false}
                />
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DepartmentSection({
  department,
  count,
  forest,
  isAdmin,
  onEdit,
}: {
  department: Department;
  count: number;
  forest: OrgNode[];
  isAdmin: boolean;
  onEdit: (profile: Profile) => void;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
          {department}
        </h2>
        <span className="text-xs text-[var(--muted)]">
          {count} {count === 1 ? "person" : "people"}
        </span>
      </header>

      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-4 py-6 text-center text-sm text-[var(--muted)]">
          No one assigned to {department} yet.
          {isAdmin
            ? " Add the department on a person’s profile (people can belong to more than one)."
            : ""}
        </p>
      ) : (
        <ul className="space-y-2">
          {forest.map((node) => (
            <OrgBranch
              key={node.profile.id}
              node={node}
              depth={0}
              isAdmin={isAdmin}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function OrgBranch({
  node,
  depth,
  isAdmin,
  onEdit,
}: {
  node: OrgNode;
  depth: number;
  isAdmin: boolean;
  onEdit: (profile: Profile) => void;
}) {
  return (
    <li>
      <OrgPersonRow
        profile={node.profile}
        depth={depth}
        isAdmin={isAdmin}
        onEdit={onEdit}
        showDepartments
      />
      {node.children.length > 0 ? (
        <ul className="mt-2 space-y-2 border-l border-[var(--border)] ml-4 pl-0">
          {node.children.map((child) => (
            <OrgBranch
              key={child.profile.id}
              node={child}
              depth={depth + 1}
              isAdmin={isAdmin}
              onEdit={onEdit}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OrgPersonRow({
  profile: p,
  depth,
  isAdmin,
  onEdit,
  showDepartments,
}: {
  profile: Profile;
  depth: number;
  isAdmin: boolean;
  onEdit: (profile: Profile) => void;
  showDepartments: boolean;
}) {
  const name = p.full_name || p.email;
  const initial = (p.full_name || p.email).charAt(0).toUpperCase();
  const hex = p.color?.match(/^#[0-9A-Fa-f]{6}$/) ? p.color : null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-sm"
      style={{
        marginLeft: depth * 16,
        ...(hex
          ? { borderLeftWidth: 4, borderLeftColor: hex }
          : {}),
      }}
    >
      {p.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.avatar_url}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
          style={hex ? { boxShadow: `0 0 0 2px ${hex}` } : undefined}
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={
            hex
              ? {
                  backgroundColor: `${hex}33`,
                  color: hex,
                  boxShadow: `0 0 0 2px ${hex}`,
                }
              : {
                  backgroundColor: "var(--brand-soft)",
                  color: "var(--brand)",
                }
          }
        >
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--foreground)]">{name}</p>
        <p className="truncate text-xs text-[var(--muted)]">
          {p.title || ROLE_LABELS[p.role]}
          {showDepartments && p.departments.length > 0
            ? ` · ${p.departments.join(", ")}`
            : ""}
        </p>
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={() => onEdit(p)}
          className="text-xs font-medium text-[var(--brand)] hover:underline"
        >
          Edit
        </button>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-12 text-center">
      <p className="font-medium text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
