"use server";

import { getRealProfile } from "@/lib/auth/profile";
import { cleanHubUrl } from "@/lib/hub-switcher/tiles";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const p = await getRealProfile();
  if (!p) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("is_owner").eq("id", p.id).single();
  return data?.is_owner ? p : null;
}

export async function saveHubLinkAction(input: {
  slug: string;
  name: string;
  url: string;
  logoUrl: string;
  enabled: boolean;
}): Promise<{ error: string | null }> {
  if (!(await requireOwner())) return { error: "Only the owner can change hubs." };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Give the hub a name." };
  const url = cleanHubUrl(input.url);
  if (url === null) return { error: "Use a full https:// link, or leave it empty for Coming soon." };
  const logo = input.logoUrl.trim();
  if (logo && !(logo.startsWith("/") && !logo.startsWith("//")) && cleanHubUrl(logo) === null)
    return { error: "The logo must be a /hub-logos/ path or an https:// link." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hub_links")
    .update({ name, url, logo_url: logo, enabled: input.enabled, updated_at: new Date().toISOString() })
    .eq("slug", input.slug);
  if (error) return { error: error.message };
  revalidatePath("/hub-switcher");
  return { error: null };
}

export async function setHubAccessAction(input: {
  slug: string;
  profileId: string;
  allowed: boolean;
}): Promise<{ error: string | null }> {
  if (!(await requireOwner())) return { error: "Only the owner can change who sees a hub." };
  const supabase = await createClient();
  const q = input.allowed
    ? supabase.from("hub_link_access").upsert({ hub_slug: input.slug, profile_id: input.profileId })
    : supabase.from("hub_link_access").delete().eq("hub_slug", input.slug).eq("profile_id", input.profileId);
  const { error } = await q;
  if (error) return { error: error.message };
  return { error: null };
}
