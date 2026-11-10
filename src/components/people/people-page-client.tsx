"use client";

import { useMemo, useState } from "react";
import { Plus, Search, UserPlus } from "lucide-react";
import { PersonCard, BirthdayRow, AnniversaryRow } from "@/components/people/person-card";
import { PersonDetailModal } from "@/components/people/person-detail-modal";
import { ProfileFormModal } from "@/components/people/profile-form-modal";
import { OrgChartPanel } from "@/components/people/org-chart-panel";
import { OnboardingPanel } from "@/components/people/onboarding-panel";
import { upcomingAnniversaries } from "@/lib/people/anniversaries";
import { upcomingBirthdays } from "@/lib/people/birthdays";
import type { OnboardingResource } from "@/lib/people/onboarding";
import type { PersonAwardSummary } from "@/lib/points/monthly-awards-types";
import {
  DEPARTMENTS,
  ROLE_LABELS,
  type Department,
  type Profile,
  type UserRole,
} from "@/lib/types/database";
import { supabaseAuthUsersDashboardUrl } from "@/lib/supabase/dashboard";
import type { DepartmentManagerMap } from "@/lib/types/department-managers";

type Tab = "directory" | "birthdays" | "anniversaries" | "org-chart" | "onboarding";

type PeoplePageClientProps = {
  profiles: Profile[];
  onboardingResources: OnboardingResource[];
  isAdmin: boolean;
  viewerId: string | null;
  viewerRole: UserRole;
  viewerDepartments: Department[];
  departmentManagers?: DepartmentManagerMap;
  /** @deprecated Unused — LRE uses a shared HoneyBook calendar. */
  awardSummaries?: Record<string, PersonAwardSummary>;
  initialTab?: Tab;
};

export function PeoplePageClient({
  profiles,
  onboardingResources,
  isAdmin,
  viewerId,
  viewerRole,
  viewerDepartments,
  departmentManagers = {},
  awardSummaries = {},
  initialTab = "directory",
}: PeoplePageClientProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<Department | "all">("all");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactivePicker, setShowInactivePicker] = useState(false);

  const viewing = useMemo(
    () => profiles.find((p) => p.id === viewingId) ?? null,
    [profiles, viewingId],
  );
  const editing = useMemo(
    () => profiles.find((p) => p.id === editingId) ?? null,
    [profiles, editingId],
  );

  function openPerson(profile: Profile) {
    setViewingId(profile.id);
  }

  function editPerson(profile: Profile) {
    setEditingId(profile.id);
  }

  const supabaseInviteUrl = supabaseAuthUsersDashboardUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  function handleAddPerson() {
    const opening = !showInactivePicker;
    setShowInactivePicker(opening);
    if (opening && supabaseInviteUrl) {
      window.open(supabaseInviteUrl, "_blank", "noopener,noreferrer");
    }
  }

  const activeProfiles = useMemo(
    () => profiles.filter((p) => p.is_active),
    [profiles],
  );

  const inactiveProfiles = useMemo(
    () => profiles.filter((p) => !p.is_active),
    [profiles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeProfiles.filter((p) => {
      if (department !== "all" && !p.departments.includes(department)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        p.full_name,
        p.email,
        p.role,
        ROLE_LABELS[p.role],
        ...p.departments,
        p.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeProfiles, department, query]);

  const birthdays = useMemo(
    () => upcomingBirthdays(activeProfiles),
    [activeProfiles],
  );

  const anniversaries = useMemo(
    () => upcomingAnniversaries(activeProfiles),
    [activeProfiles],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
            People
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Team Directory
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Directory, birthdays, anniversaries, org chart, and onboarding for
            the LRE crew.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddPerson}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              <UserPlus className="h-4 w-4" />
              Add person
            </button>
          </div>
        )}
      </div>

      {isAdmin && showInactivePicker && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Add someone to the directory
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Invite them first in Supabase (
            <span className="font-medium">Authentication → Users → Invite</span>
            ). A Supabase tab should have opened for you
            {supabaseInviteUrl ? (
              <>
                {" "}
                (
                <a
                  href={supabaseInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
                >
                  open Auth → Users
                </a>
                )
              </>
            ) : null}
            . Then pick them below to fill in title, departments, birthday, and
            more — or edit anyone already listed.
          </p>
          {inactiveProfiles.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {inactiveProfiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id);
                      setShowInactivePicker(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                  >
                    <span className="font-medium text-[var(--foreground)]">
                      {p.full_name || p.email}
                    </span>
                    <span className="text-[var(--muted)]">{p.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No inactive profiles waiting. After you invite someone, use the
              pencil on their card to edit details.
            </p>
          )}
          {activeProfiles.length > 0 && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Tip: hover any card and click the pencil to edit.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1 border-b border-[var(--border)]">
        <TabButton
          active={tab === "directory"}
          onClick={() => setTab("directory")}
        >
          Directory
        </TabButton>
        <TabButton
          active={tab === "birthdays"}
          onClick={() => setTab("birthdays")}
        >
          Birthdays
        </TabButton>
        <TabButton
          active={tab === "anniversaries"}
          onClick={() => setTab("anniversaries")}
        >
          Anniversaries
        </TabButton>
        <TabButton
          active={tab === "org-chart"}
          onClick={() => setTab("org-chart")}
        >
          Org Chart
        </TabButton>
        <TabButton
          active={tab === "onboarding"}
          onClick={() => setTab("onboarding")}
        >
          Onboarding
        </TabButton>
      </div>

      {tab === "directory" && (
        <>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, role, or department…"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pr-3 pl-9 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                aria-label="Search people"
              />
            </div>
            <select
              value={department}
              onChange={(e) =>
                setDepartment(e.target.value as Department | "all")
              }
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              aria-label="Filter by department"
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No people found"
              body={
                activeProfiles.length === 0
                  ? "Invite staff in Supabase Auth, then edit their profiles here."
                  : "Try a different search or department filter."
              }
            />
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((profile) => (
                <PersonCard
                  key={profile.id}
                  profile={profile}
                  isAdmin={isAdmin}
                  awardSummary={awardSummaries[profile.id] ?? null}
                  onOpen={openPerson}
                  onEdit={editPerson}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "birthdays" && (
        <div className="mt-5 space-y-2">
          {birthdays.length === 0 ? (
            <EmptyState
              title="No upcoming birthdays"
              body="Add birthdays when editing a person’s profile."
            />
          ) : (
            birthdays.map(({ profile, daysUntil, label }) => (
              <BirthdayRow
                key={profile.id}
                name={profile.full_name || profile.email}
                departments={profile.departments}
                label={label}
                daysUntil={daysUntil}
                avatarUrl={profile.avatar_url}
                color={profile.color}
              />
            ))
          )}
        </div>
      )}

      {tab === "anniversaries" && (
        <div className="mt-5 space-y-2">
          {anniversaries.length === 0 ? (
            <EmptyState
              title="No upcoming work anniversaries"
              body="Add a start date when editing a person’s profile."
            />
          ) : (
            anniversaries.map(
              ({ profile, daysUntil, label, yearsLabel }) => (
                <AnniversaryRow
                  key={profile.id}
                  name={profile.full_name || profile.email}
                  departments={profile.departments}
                  label={label}
                  yearsLabel={yearsLabel}
                  daysUntil={daysUntil}
                  avatarUrl={profile.avatar_url}
                  color={profile.color}
                />
              ),
            )
          )}
        </div>
      )}

      {tab === "org-chart" && (
        <OrgChartPanel
          profiles={profiles}
          departmentManagers={departmentManagers}
          isAdmin={isAdmin}
          onEdit={editPerson}
        />
      )}

      {tab === "onboarding" && (
        <OnboardingPanel
          resources={onboardingResources}
          isAdmin={isAdmin}
          viewerDepartments={viewerDepartments}
          viewerRole={viewerRole}
        />
      )}

      <PersonDetailModal
        key={viewing ? viewing.id : "closed"}
        open={Boolean(viewing)}
        profile={viewing}
        profiles={profiles}
        departmentManagers={departmentManagers}
        viewerId={viewerId}
        isAdmin={isAdmin}
        awardSummary={
          viewing ? (awardSummaries[viewing.id] ?? null) : null
        }
        onClose={() => setViewingId(null)}
        onAdminEdit={editPerson}
      />

      <ProfileFormModal
        key={editing ? editing.id : "closed"}
        open={Boolean(editing)}
        profile={editing}
        managerCandidates={profiles}
        departmentManagers={departmentManagers}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand)] text-[var(--brand)]"
          : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-12 text-center">
      <Plus className="mx-auto h-8 w-8 text-[var(--muted)]/50" />
      <p className="mt-3 font-medium text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
