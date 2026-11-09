"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canAddResource, canEditResource } from "@/lib/resources/access";
import type {
  ResourceType,
  ResourceVisibility,
} from "@/lib/types/resources";

async function requireResourceRole(
  allowed: (role: string | null | undefined) => boolean,
  deniedMessage: string,
) {
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

  const role = profile?.role as string | undefined;
  if (!allowed(role)) {
    return {
      supabase,
      user: null,
      error: deniedMessage,
    };
  }

  return { supabase, user, error: null, role };
}

export async function createResourceAction(formData: FormData): Promise<{
  error: string | null;
}> {
  const { supabase, user, error } = await requireResourceRole(
    canAddResource,
    "Only staff can add resources.",
  );
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ResourceType;
  const description = String(formData.get("description") ?? "").trim();
  const visibility = (String(formData.get("visibility") ?? "everyone") ||
    "everyone") as ResourceVisibility;
  const linkUrl = String(formData.get("url") ?? "").trim();
  const file = formData.get("file");

  if (!title) return { error: "Title is required." };
  if (type !== "file" && type !== "link") {
    return { error: "Type must be file or link." };
  }
  if (!["everyone", "staff", "admin"].includes(visibility)) {
    return { error: "Invalid visibility." };
  }

  let url = linkUrl;

  if (type === "link") {
    if (!url) return { error: "URL is required for links." };
    try {
      // Basic validation
      new URL(url);
    } catch {
      return { error: "Enter a valid URL (include https://)." };
    }
  } else {
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a file to upload." };
    }

    const safeName = file.name.replace(/[^\w.\-()+ ]+/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("resources")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    url = path;
  }

  const { error: insertError } = await supabase.from("resources").insert({
    title,
    category,
    type,
    url,
    description,
    visibility,
    created_by: user.id,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/resources");
  return { error: null };
}

export async function updateResourceAction(
  id: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireResourceRole(
    canEditResource,
    "Only leads and admins can edit resources.",
  );
  if (error || !user) return { error: error ?? "Unauthorized" };

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const visibility = (String(formData.get("visibility") ?? "everyone") ||
    "everyone") as ResourceVisibility;
  const linkUrl = String(formData.get("url") ?? "").trim();

  if (!title) return { error: "Title is required." };
  if (!["everyone", "staff", "admin"].includes(visibility)) {
    return { error: "Invalid visibility." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("resources")
    .select("id, type, url")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Resource not found." };

  const payload: {
    title: string;
    category: string;
    description: string;
    visibility: ResourceVisibility;
    url?: string;
  } = {
    title,
    category,
    description,
    visibility,
  };

  if (existing.type === "link") {
    if (!linkUrl) return { error: "URL is required for links." };
    try {
      new URL(linkUrl);
    } catch {
      return { error: "Enter a valid URL (include https://)." };
    }
    payload.url = linkUrl;
  }

  const { error: updateError } = await supabase
    .from("resources")
    .update(payload)
    .eq("id", id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/resources");
  return { error: null };
}

export async function deleteResourceAction(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "Only admins can delete resources." };
  }

  const { data: resource } = await supabase
    .from("resources")
    .select("id, type, url")
    .eq("id", id)
    .maybeSingle();

  if (!resource) return { error: "Resource not found." };

  if (resource.type === "file" && resource.url) {
    await supabase.storage.from("resources").remove([resource.url]);
  }

  const { error: deleteError } = await supabase
    .from("resources")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/resources");
  return { error: null };
}

export async function getFileDownloadUrlAction(
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { url: null, error: "You must be signed in." };

  const { data, error } = await supabase.storage
    .from("resources")
    .createSignedUrl(path, 60 * 10);

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? "Could not create download link." };
  }

  return { url: data.signedUrl, error: null };
}

/** Award once per resource when staff open/play an in-Hub video. */
export async function awardResourceVideoPlayAction(
  resourceId: string,
): Promise<{ error: string | null; awarded?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const id = resourceId.trim();
  if (!id) return { error: "Missing resource." };

  const { data: resource } = await supabase
    .from("resources")
    .select("id, url, type")
    .eq("id", id)
    .maybeSingle();
  if (!resource || resource.type !== "link") {
    return { error: "Resource not found." };
  }

  const { getVideoEmbed } = await import("@/lib/resources/video-embed");
  if (!getVideoEmbed(String(resource.url))) {
    return { error: "Not a playable video resource." };
  }

  try {
    const { awardAchievement } = await import("@/lib/points/hub-points");
    const result = await awardAchievement(supabase, "resource_video_watched", {
      resource_id: id,
    });
    return { error: null, awarded: result.awarded };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not award points.",
    };
  }
}
