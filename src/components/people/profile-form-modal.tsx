"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  DEPARTMENTS,
  ROLE_LABELS,
  ROLES,
  type Department,
  type Profile,
  type UserRole,
} from "@/lib/types/database";
import { updateProfileAction } from "@/app/(app)/people/actions";
import type { DepartmentManagerMap } from "@/lib/types/department-managers";

type ProfileFormModalProps = {
  open: boolean;
  profile: Profile | null;
  /** Active + inactive staff used for Manager select (self excluded in UI). */
  managerCandidates?: Profile[];
  /** Existing per-department manager assignments. */
  departmentManagers?: DepartmentManagerMap;
  onClose: () => void;
};

const emptyForm = {
  full_name: "",
  email: "",
  role: "staff" as UserRole,
  departments: [] as Department[],
  title: "",
  phone: "",
  birthday: "",
  start_date: "",
  bio: "",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  twitter_url: "",
  is_active: true,
  avatar_url: "",
  color: "",
  managers_by_dept: {} as Partial<Record<Department, string>>,
};

function managersFromProfile(
  profile: Profile,
  departmentManagers: DepartmentManagerMap,
): Partial<Record<Department, string>> {
  const result: Partial<Record<Department, string>> = {};
  for (const dept of profile.departments ?? []) {
    const assigned = departmentManagers[profile.id]?.[dept];
    if (assigned) {
      result[dept] = assigned;
    } else if (profile.reports_to) {
      // Fallback to legacy global manager until per-dept rows exist.
      result[dept] = profile.reports_to;
    } else {
      result[dept] = "";
    }
  }
  return result;
}

function formFromProfile(
  profile: Profile,
  departmentManagers: DepartmentManagerMap,
): typeof emptyForm {
  return {
    full_name: profile.full_name ?? "",
    email: profile.email ?? "",
    role: profile.role,
    departments: profile.departments ?? [],
    title: profile.title ?? "",
    phone: profile.phone ?? "",
    birthday: profile.birthday ?? "",
    start_date: profile.start_date ?? "",
    bio: profile.bio ?? "",
    facebook_url: profile.facebook_url ?? "",
    instagram_url: profile.instagram_url ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    twitter_url: profile.twitter_url ?? "",
    is_active: profile.is_active ?? true,
    avatar_url: profile.avatar_url ?? "",
    color: profile.color ?? "",
    managers_by_dept: managersFromProfile(profile, departmentManagers),
  };
}

export function ProfileFormModal({
  open,
  profile,
  managerCandidates = [],
  departmentManagers = {},
  onClose,
}: ProfileFormModalProps) {
  const router = useRouter();
  const titleId = useId();
  const [form, setForm] = useState(() =>
    profile ? formFromProfile(profile, departmentManagers) : emptyForm,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open || !profile) return null;

  function setField<K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDepartment(dept: Department) {
    setForm((prev) => {
      const has = prev.departments.includes(dept);
      const departments = has
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept];
      const managers_by_dept = { ...prev.managers_by_dept };
      if (has) {
        delete managers_by_dept[dept];
      } else if (managers_by_dept[dept] === undefined) {
        managers_by_dept[dept] = "";
      }
      return { ...prev, departments, managers_by_dept };
    });
  }

  function setDepartmentManager(dept: Department, managerId: string) {
    setForm((prev) => ({
      ...prev,
      managers_by_dept: {
        ...prev.managers_by_dept,
        [dept]: managerId,
      },
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const department_managers: Partial<Record<Department, string | null>> = {};
    for (const dept of form.departments) {
      const value = form.managers_by_dept[dept]?.trim() || null;
      department_managers[dept] = value;
    }

    startTransition(async () => {
      const result = await updateProfileAction({
        id: profile!.id,
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        departments: form.departments,
        title: form.title,
        phone: form.phone,
        birthday: form.birthday,
        start_date: form.start_date,
        bio: form.bio,
        facebook_url: form.facebook_url,
        instagram_url: form.instagram_url,
        linkedin_url: form.linkedin_url,
        twitter_url: form.twitter_url,
        is_active: form.is_active,
        avatar_url: form.avatar_url,
        color: form.color,
        department_managers,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/30 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              Edit person
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Update directory details for this staff member.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </div>
          )}

          <Field label="Full name">
            <input
              required
              value={form.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Email">
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value as UserRole)}
              className={inputClass}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[var(--foreground)]">
              Departments
            </legend>
            <p className="text-xs text-[var(--muted)]">
              Select all that apply — people can work in more than one.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEPARTMENTS.map((dept) => {
                const checked = form.departments.includes(dept);
                return (
                  <label
                    key={dept}
                    className={[
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDepartment(dept)}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    {dept}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {form.departments.length > 0 ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-[var(--foreground)]">
                Manager by department
              </legend>
              <p className="text-xs text-[var(--muted)]">
                Set who they report to in each department org chart. Multi-department
                staff can have a different manager per chart.
              </p>
              {form.departments.map((dept) => (
                <Field key={dept} label={`${dept} manager`}>
                  <select
                    value={form.managers_by_dept[dept] ?? ""}
                    onChange={(e) => setDepartmentManager(dept, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">No manager (top-level in {dept})</option>
                    {managerCandidates
                      .filter((candidate) => candidate.id !== profile.id)
                      .filter((candidate) => candidate.is_active)
                      .sort((a, b) =>
                        (a.full_name || a.email).localeCompare(
                          b.full_name || b.email,
                        ),
                      )
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.full_name || candidate.email}
                          {candidate.departments.includes(dept)
                            ? ""
                            : " (other dept)"}
                        </option>
                      ))}
                  </select>
                </Field>
              ))}
            </fieldset>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
              Choose at least one department to assign org-chart managers.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                className={inputClass}
                placeholder="e.g. AV Technician"
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className={inputClass}
                placeholder="(555) 555-5555"
              />
            </Field>
          </div>

          <p className="text-xs leading-relaxed text-[var(--muted)]">
            By providing your mobile number, you agree to receive operational
            text messages from LRE Productions (scheduling, event details, team
            huddle reminders, and staff alerts). Message frequency varies.
            Message &amp; data rates may apply. Reply STOP to opt out, HELP for
            help. See our{" "}
            <a
              href="/sms-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--brand)] hover:underline"
            >
              SMS Terms
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--brand)] hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Birthday">
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setField("birthday", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Start date">
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Avatar URL">
            <input
              value={form.avatar_url}
              onChange={(e) => setField("avatar_url", e.target.value)}
              className={inputClass}
              placeholder="https://…"
            />
          </Field>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-[var(--foreground)]">
              Social links
            </legend>
            <p className="text-xs text-[var(--muted)]">
              Optional public profile URLs shown on People cards.
            </p>
            <Field label="Facebook">
              <input
                type="text"
                inputMode="url"
                value={form.facebook_url}
                onChange={(e) => setField("facebook_url", e.target.value)}
                className={inputClass}
                placeholder="https://facebook.com/… or facebook.com/…"
                autoComplete="off"
              />
            </Field>
            <Field label="Instagram">
              <input
                type="text"
                inputMode="url"
                value={form.instagram_url}
                onChange={(e) => setField("instagram_url", e.target.value)}
                className={inputClass}
                placeholder="https://instagram.com/… or instagram.com/…"
                autoComplete="off"
              />
            </Field>
            <Field label="LinkedIn">
              <input
                type="text"
                inputMode="url"
                value={form.linkedin_url}
                onChange={(e) => setField("linkedin_url", e.target.value)}
                className={inputClass}
                placeholder="https://linkedin.com/in/… or linkedin.com/in/…"
                autoComplete="off"
              />
            </Field>
            <Field label="X (Twitter)">
              <input
                type="text"
                inputMode="url"
                value={form.twitter_url}
                onChange={(e) => setField("twitter_url", e.target.value)}
                className={inputClass}
                placeholder="https://x.com/… or x.com/…"
                autoComplete="off"
              />
            </Field>
          </fieldset>

          <Field label="Identity color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={
                  /^#[0-9A-Fa-f]{6}$/.test(form.color)
                    ? form.color
                    : "#52525B"
                }
                onChange={(e) => setField("color", e.target.value.toUpperCase())}
                className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--background)] p-1"
                aria-label="Pick identity color"
              />
              <input
                value={form.color}
                onChange={(e) => setField("color", e.target.value)}
                className={inputClass}
                placeholder="#0084C6"
                maxLength={7}
              />
              {form.color ? (
                <button
                  type="button"
                  onClick={() => setField("color", "")}
                  className="shrink-0 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Used on People cards, Calendar chips, and the Team colors legend.
            </p>
          </Field>

          <Field label="Bio">
            <textarea
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
              className={`${inputClass} min-h-20 py-2`}
              rows={3}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setField("is_active", e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--brand)]"
            />
            Active (show in directory)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]";
