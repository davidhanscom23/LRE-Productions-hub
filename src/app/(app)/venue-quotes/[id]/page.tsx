import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { VenuePortalEditor } from "@/components/venue-portal-admin/venue-portal-editor";

export const metadata = { title: "Edit venue quote page" };

export default async function EditVenuePortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: portal } = await supabase
    .from("venue_portals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!portal) notFound();

  const { data: secret } = await supabase
    .from("venue_portal_secrets")
    .select("portal_id")
    .eq("portal_id", id)
    .maybeSingle();

  const byOrder = { ascending: true } as const;
  const [
    spaces,
    packages,
    items,
    addons,
    enhancements,
    technicians,
    techLinks,
    products,
    services,
  ] = await Promise.all([
    supabase.from("venue_portal_spaces").select("*").eq("portal_id", id).order("sort_order", byOrder),
    supabase.from("venue_portal_packages").select("*").eq("portal_id", id).order("sort_order", byOrder),
    supabase.from("venue_portal_package_items").select("*").order("sort_order", byOrder),
    supabase.from("venue_portal_addons").select("*").eq("portal_id", id).order("sort_order", byOrder),
    supabase.from("venue_portal_enhancements").select("*").eq("portal_id", id).order("sort_order", byOrder),
    supabase.from("venue_portal_technicians").select("*").eq("portal_id", id).order("sort_order", byOrder),
    supabase.from("venue_portal_package_technicians").select("*"),
    supabase
      .from("av_products")
      .select("id, name, sku")
      .eq("is_retired", false)
      .order("name", byOrder)
      .limit(500),
    supabase
      .from("av_services")
      .select("id, name")
      .eq("is_retired", false)
      .order("name", byOrder)
      .limit(500),
  ]);

  const pkgIds = new Set((packages.data ?? []).map((p) => p.id as string));
  const itemsByPkg: Record<string, string[]> = {};
  for (const it of items.data ?? []) {
    if (!pkgIds.has(it.package_id as string)) continue;
    (itemsByPkg[it.package_id as string] ??= []).push(it.label as string);
  }

  const techIdsByPkg: Record<string, string[]> = {};
  for (const l of techLinks.data ?? []) {
    if (!pkgIds.has(l.package_id as string)) continue;
    (techIdsByPkg[l.package_id as string] ??= []).push(l.technician_id as string);
  }

  return (
    <VenuePortalEditor
      portal={portal}
      spaces={spaces.data ?? []}
      packages={(packages.data ?? []).map((p) => ({ ...p, items: itemsByPkg[p.id as string] ?? [], technician_ids: techIdsByPkg[p.id as string] ?? [] }))}
      addons={addons.data ?? []}
      enhancements={enhancements.data ?? []}
      technicians={technicians.data ?? []}
      hasCoordinatorPassword={!!secret}
      techTablesMissing={!!technicians.error}
      catalogProducts={(products.data ?? []).map((p) => ({
        id: String(p.id),
        label: `${p.name}${p.sku ? ` (${p.sku})` : ""}`,
      }))}
      catalogServices={(services.data ?? []).map((s) => ({
        id: String(s.id),
        label: String(s.name),
      }))}
    />
  );
}
