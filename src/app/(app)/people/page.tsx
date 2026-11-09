import { PeoplePageClient } from "@/components/people/people-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  DEFAULT_ONBOARDING_RESOURCES,
  filterOnboardingForViewer,
  withOnboardingMeta,
  type OnboardingResource,
} from "@/lib/people/onboarding";
import { getPersonAwardSummaries } from "@/lib/points/monthly-awards";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDepartments,
  type Department,
  type Profile,
  type UserRole,
} from "@/lib/types/database";
import { normalizeHexColor } from "@/lib/people/color";
import {
  PROFILE_SAFE_COLUMNS,
  PROFILE_SAFE_COLUMNS_PRE_SOCIAL,
  PROFILE_SAFE_COLUMNS_PRE_THEME,
  isProfilesSocialSelectError,
  isProfilesThemeSelectError,
} from "@/lib/types/profile-columns";
import { normalizeThemePreference } from "@/lib/theme/preference";
import {
  buildDepartmentManagerMap,
  type DepartmentManagerEdge,
  type DepartmentManagerMap,
} from "@/lib/types/department-managers";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const current = await getCurrentProfile();
  const params = await searchParams;
  const tabParam = params.tab;
  const initialTab =
    tabParam === "birthdays" ||
    tabParam === "anniversaries" ||
    tabParam === "org-chart" ||
    tabParam === "onboarding" ||
    tabParam === "directory"
      ? tabParam
      : "directory";

  let { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SAFE_COLUMNS)
    .order("full_name", { ascending: true });

  if (error && isProfilesSocialSelectError(error.message)) {
    const fallbackSocial = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS_PRE_SOCIAL)
      .order("full_name", { ascending: true });
    data = fallbackSocial.data as typeof data;
    error = fallbackSocial.error;
  }

  if (error && isProfilesThemeSelectError(error.message)) {
    const fallback = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_COLUMNS_PRE_THEME)
      .order("full_name", { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Couldn’t load people: {error.message}
      </div>
    );
  }

  const profiles = (data ?? []).map((row) => {
    const profile = row as Profile & { reports_to?: string | null };
    return {
      ...profile,
      departments: normalizeDepartments(
        (row as { departments?: unknown }).departments,
      ),
      color: normalizeHexColor((row as { color?: unknown }).color),
      reports_to: profile.reports_to ?? null,
      facebook_url: profile.facebook_url ?? null,
      instagram_url: profile.instagram_url ?? null,
      linkedin_url: profile.linkedin_url ?? null,
      twitter_url: profile.twitter_url ?? null,
      theme_preference: normalizeThemePreference(
        (row as { theme_preference?: unknown }).theme_preference,
      ),
    };
  });

  const allOnboardingResources = await loadOnboardingResources(supabase);
  const isAdmin = current?.role === "admin";
  const viewerRole: UserRole = current?.role ?? "staff";
  const viewerDepartments = current?.departments ?? [];
  // Filter on the server so admin-only doc URLs are not sent to staff/trainers.
  const onboardingResources = filterOnboardingForViewer(
    allOnboardingResources,
    { role: viewerRole, departments: viewerDepartments },
  );

  const departmentManagers = await loadDepartmentManagers(supabase);

  let awardSummaries = new Map<
    string,
    import("@/lib/points/monthly-awards-types").PersonAwardSummary
  >();
  try {
    awardSummaries = await getPersonAwardSummaries(
      supabase,
      profiles.map((p) => p.id),
    );
  } catch {
    // Migration 079 may not be applied yet
  }

  return (
    <PeoplePageClient
      profiles={profiles}
      onboardingResources={onboardingResources}
      isAdmin={isAdmin}
      viewerId={current?.id ?? null}
      viewerRole={viewerRole}
      viewerDepartments={viewerDepartments}
      departmentManagers={departmentManagers}
      awardSummaries={Object.fromEntries(awardSummaries)}
      initialTab={initialTab}
    />
  );
}

async function loadDepartmentManagers(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DepartmentManagerMap> {
  const { data, error } = await supabase
    .from("profile_department_managers")
    .select("profile_id, department, reports_to");

  if (error || !data) {
    // Before migration 024 the table may not exist yet.
    return {};
  }

  return buildDepartmentManagerMap(
    (data as DepartmentManagerEdge[]).map((row) => ({
      profile_id: row.profile_id,
      department: row.department as Department,
      reports_to: row.reports_to,
    })),
  );
}

async function loadOnboardingResources(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<OnboardingResource[]> {
  const { data, error } = await supabase
    .from("onboarding_resources")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    const now = new Date().toISOString();
    return DEFAULT_ONBOARDING_RESOURCES.map((resource, index) =>
      withOnboardingMeta({
        ...resource,
        id: `default-${resource.slug}`,
        created_at: now,
        updated_at: now,
        sort_order: resource.sort_order || (index + 1) * 10,
      }),
    );
  }

  return (
    data as Array<
      Omit<OnboardingResource, "departments" | "adminOnly"> & {
        departments?: Department[] | null;
        adminOnly?: boolean | null;
      }
    >
  ).map((row) =>
    withOnboardingMeta({
      ...row,
      url: row.url ?? "",
      description: row.description ?? "",
    }),
  );
}
