"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { wouldCreateDepartmentCycle } from "@/lib/people/org-chart";
import { normalizeHexColor } from "@/lib/people/color";
import {
  normalizeDepartments,
  type Department,
  type Profile,
  type UserRole,
} from "@/lib/types/database";
import { PROFILE_SAFE_COLUMNS } from "@/lib/types/profile-columns";
import {
  buildDepartmentManagerMap,
  type DepartmentManagerEdge,
} from "@/lib/types/department-managers";
import { normalizeProfileSocialLinks } from "@/lib/people/social-links";

export type ProfileFormInput = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  departments: Department[];
  title: string;
  phone: string;
  birthday: string;
  start_date: string;
  bio: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  twitter_url: string;
  is_active: boolean;
  avatar_url: string;
  /** #RRGGBB or empty to clear. */
  color: string;
  /**
   * Manager per department for org charts.
   * Only departments the person belongs to are saved.
   */
  department_managers: Partial<Record<Department, string | null>>;
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: "You must be signed in." as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { supabase, error: "Only admins can edit people." as const };
  }

  return { supabase, error: null };
}

export async function updateProfileAction(
  input: ProfileFormInput,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const departments = normalizeDepartments(input.departments);

  const { data: allRows } = await supabase
    .from("profiles")
    .select(PROFILE_SAFE_COLUMNS);
  const profiles = ((allRows ?? []) as Profile[]).map((row) => ({
    ...row,
    departments: normalizeDepartments(row.departments),
    reports_to: (row as { reports_to?: string | null }).reports_to ?? null,
    theme_preference: row.theme_preference ?? null,
  }));

  const { data: edgeRows } = await supabase
    .from("profile_department_managers")
    .select("profile_id, department, reports_to");

  const existingEdges = ((edgeRows ?? []) as DepartmentManagerEdge[]).map(
    (row) => ({
      profile_id: row.profile_id,
      department: row.department as Department,
      reports_to: row.reports_to,
    }),
  );
  const managerMap = buildDepartmentManagerMap(existingEdges);

  // Validate + normalize per-department managers for selected departments only.
  const departmentManagers: Array<{
    department: Department;
    reports_to: string | null;
  }> = [];

  for (const department of departments) {
    const raw = input.department_managers?.[department];
    const reportsTo =
      typeof raw === "string" && raw.trim() ? raw.trim() : null;

    if (reportsTo === input.id) {
      return {
        error: `Someone can’t report to themselves in ${department}.`,
      };
    }

    // Apply this person's proposed edges into a working map for cycle checks.
    if (!managerMap[input.id]) managerMap[input.id] = {};
    managerMap[input.id]![department] = reportsTo;

    if (
      wouldCreateDepartmentCycle(
        profiles,
        managerMap,
        department,
        input.id,
        reportsTo,
      )
    ) {
      return {
        error: `That ${department} manager would create a loop in the org chart. Pick someone else.`,
      };
    }

    departmentManagers.push({ department, reports_to: reportsTo });
  }

  // Keep legacy reports_to aligned with the first department that has a manager
  // (or null) so older detail views still show something sensible.
  const legacyReportsTo =
    departmentManagers.find((row) => row.reports_to)?.reports_to ?? null;

  const colorRaw = (input.color ?? "").trim();
  let color: string | null = null;
  if (colorRaw) {
    const normalized = normalizeHexColor(colorRaw);
    if (!normalized) {
      return { error: "Color must be a 6-digit hex like #0084C6." };
    }
    color = normalized;
  }

  const social = normalizeProfileSocialLinks({
    facebook_url: input.facebook_url,
    instagram_url: input.instagram_url,
    linkedin_url: input.linkedin_url,
    twitter_url: input.twitter_url,
  });
  if (social.error) return { error: social.error };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      email: input.email.trim(),
      role: input.role,
      departments,
      title: input.title.trim() || null,
      phone: input.phone.trim() || null,
      birthday: input.birthday || null,
      start_date: input.start_date || null,
      bio: input.bio.trim() || null,
      facebook_url: social.links.facebook_url,
      instagram_url: social.links.instagram_url,
      linkedin_url: social.links.linkedin_url,
      twitter_url: social.links.twitter_url,
      is_active: input.is_active,
      avatar_url: input.avatar_url.trim() || null,
      color,
      reports_to: legacyReportsTo,
    })
    .eq("id", input.id);

  if (updateError) {
    return { error: updateError.message };
  }

  // Replace department manager rows for this person.
  const { error: deleteError } = await supabase
    .from("profile_department_managers")
    .delete()
    .eq("profile_id", input.id);

  if (deleteError) {
    // Table may not exist yet before migration 024.
    if (!/profile_department_managers|does not exist/i.test(deleteError.message)) {
      return { error: deleteError.message };
    }
  } else if (departmentManagers.length > 0) {
    const { error: insertError } = await supabase
      .from("profile_department_managers")
      .insert(
        departmentManagers.map((row) => ({
          profile_id: input.id,
          department: row.department,
          reports_to: row.reports_to,
          updated_at: new Date().toISOString(),
        })),
      );
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/people");
  revalidatePath("/calendar");
  revalidatePath("/my-week");
  revalidatePath("/", "layout");
  return { error: null };
}

/** Admin-only quick color update (sidebar legend / color wheel). */
export async function updateProfileColorAction(input: {
  id: string;
  color: string | null;
}): Promise<{ error: string | null }> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  let color: string | null = null;
  if (input.color != null && input.color.trim()) {
    const normalized = normalizeHexColor(input.color);
    if (!normalized) {
      return { error: "Color must be a 6-digit hex like #0084C6." };
    }
    color = normalized;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ color })
    .eq("id", input.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/people");
  revalidatePath("/calendar");
  revalidatePath("/my-week");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateOnboardingResourceUrlAction(input: {
  id: string;
  url: string;
}): Promise<{ error: string | null }> {
  const { supabase, error } = await requireAdmin();
  if (error) return { error };

  const url = input.url.trim();
  if (url) {
    try {
      new URL(url);
    } catch {
      return { error: "Enter a valid URL (include https://) or leave blank." };
    }
  }

  const { error: updateError } = await supabase
    .from("onboarding_resources")
    .update({ url, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/people");
  return { error: null };
}

/** Any signed-in user can update their own phone, avatar URL, bio, and social links. */
export async function updateOwnProfileDetailsAction(input: {
  phone: string;
  avatar_url: string;
  bio: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  twitter_url: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const avatar = input.avatar_url.trim();
  if (avatar) {
    try {
      const parsed = new URL(avatar);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { error: "Avatar URL must start with https://" };
      }
    } catch {
      return { error: "Avatar URL doesn’t look like a valid link." };
    }
  }

  const social = normalizeProfileSocialLinks({
    facebook_url: input.facebook_url,
    instagram_url: input.instagram_url,
    linkedin_url: input.linkedin_url,
    twitter_url: input.twitter_url,
  });
  if (social.error) return { error: social.error };

  const { error } = await supabase
    .from("profiles")
    .update({
      phone: input.phone.trim() || null,
      avatar_url: avatar || null,
      bio: input.bio.trim() || null,
      facebook_url: social.links.facebook_url,
      instagram_url: social.links.instagram_url,
      linkedin_url: social.links.linkedin_url,
      twitter_url: social.links.twitter_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/people");
  revalidatePath("/", "layout");
  return { error: null };
}
