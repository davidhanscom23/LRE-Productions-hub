import { HubAccessAdmin } from "@/components/hub-switcher/hub-access-admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HubSwitcherAdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  const supabase = await createClient();
  const { data: meRow } = await supabase.from("profiles").select("is_owner").eq("id", profile.id).single();
  if (!meRow?.is_owner) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold">Hub switcher</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Only the owner can change which hubs show in the switcher or who sees them.</p>
      </div>
    );
  }
  const { data: hubs, error } = await supabase
    .from("hub_links")
    .select("slug, name, url, logo_url, enabled")
    .order("sort_order")
    .order("name");
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_owner")
    .eq("is_active", true)
    .neq("role", "guest")
    .order("full_name");
  const { data: grants } = await supabase.from("hub_link_access").select("hub_slug, profile_id");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Hub switcher</h1>
        <p className="text-sm text-[var(--muted)]">
          Choose which company hubs show in the four-square button at the top, and who sees each one.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          The hub switcher needs migration 190_hub_switcher.sql. {error.message}
        </p>
      ) : (
        <HubAccessAdmin
          hubs={(hubs ?? []) as { slug: string; name: string; url: string; logo_url: string; enabled: boolean }[]}
          people={(people ?? []).map((p) => ({
            id: String(p.id),
            name: String(p.full_name || p.email),
            role: String(p.role),
            isOwner: Boolean(p.is_owner),
          }))}
          access={(grants ?? []).map((g) => `${g.hub_slug}:${g.profile_id}`)}
        />
      )}
    </div>
  );
}
