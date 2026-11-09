import { ResourcesPageClient } from "@/components/resources/resources-page-client";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canViewStaffHandbook } from "@/lib/handbook/settings";
import {
  canAddResource,
  canDeleteResource,
  canEditResource,
} from "@/lib/resources/access";
import { createClient } from "@/lib/supabase/server";
import type { Resource } from "@/lib/types/resources";

export default async function ResourcesPage() {
  const supabase = await createClient();
  const current = await getCurrentProfile();
  const guest = isGuestRole(current?.role);

  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Couldn’t load resources: {error.message}
      </div>
    );
  }

  const role = current?.role;
  const canAdd = !guest && canAddResource(role);
  const canManage = !guest && canEditResource(role);
  const canDelete = !guest && canDeleteResource(role);
  const showHandbook = guest
    ? false
    : await canViewStaffHandbook(role === "admin");

  return (
    <ResourcesPageClient
      resources={(data ?? []) as Resource[]}
      canAdd={canAdd}
      canManage={canManage}
      canDelete={canDelete}
      showHandbook={showHandbook}
    />
  );
}
