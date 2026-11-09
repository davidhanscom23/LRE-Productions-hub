"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MarketingLinkSection } from "@/lib/types/marketing-library";

async function requireTrainerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, error: "You must be signed in." as const };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role;
  if (role !== "admin" && role !== "trainer") {
    return {
      supabase,
      user: null,
      error: "Only trainers and admins can manage the Marketing Library." as const,
    };
  }
  return { supabase, user, error: null as string | null };
}

function validUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function createMarketingLinkAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireTrainerOrAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const section = String(formData.get("section") ?? "") as MarketingLinkSection;
  const label = String(formData.get("label") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (section !== "reviews" && section !== "photos") {
    return { error: "Invalid section." };
  }
  if (!label) return { error: "Label is required." };
  if (!validUrl(url)) return { error: "Enter a valid URL (include https://)." };

  const { error: insertError } = await supabase
    .from("marketing_links")
    .insert({ section, label, url, created_by: user.id });
  if (insertError) return { error: insertError.message };

  revalidatePath("/marketing-library");
  return { error: null };
}

export async function deleteMarketingLinkAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireTrainerOrAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: deleteError } = await supabase
    .from("marketing_links")
    .delete()
    .eq("id", id);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/marketing-library");
  return { error: null };
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function createMarketingVideoAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireTrainerOrAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category") ?? "Wedding").trim() || "Wedding";
  const djName = String(formData.get("dj_name") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));

  if (!title) return { error: "Title is required." };
  if (!validUrl(url)) return { error: "Enter a valid video URL (include https://)." };

  const { error: insertError } = await supabase.from("marketing_videos").insert({
    title,
    description,
    url,
    category,
    dj_name: djName,
    tags,
    created_by: user.id,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/marketing-library");
  return { error: null };
}

export async function updateMarketingVideoAction(
  id: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireTrainerOrAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category") ?? "Wedding").trim() || "Wedding";
  const djName = String(formData.get("dj_name") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));

  if (!title) return { error: "Title is required." };
  if (!validUrl(url)) return { error: "Enter a valid video URL (include https://)." };

  const { error: updateError } = await supabase
    .from("marketing_videos")
    .update({
      title,
      description,
      url,
      category,
      dj_name: djName,
      tags,
    })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/marketing-library");
  return { error: null };
}

export async function deleteMarketingVideoAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireTrainerOrAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: deleteError } = await supabase
    .from("marketing_videos")
    .delete()
    .eq("id", id);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/marketing-library");
  return { error: null };
}
