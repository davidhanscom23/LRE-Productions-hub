"use server";

import {
  deleteEventMediaObject,
  getEventMediaAccessUrl,
  getEventMediaStorageProvider,
  uploadEventMediaObject,
  type StorageProvider,
} from "@/lib/storage/event-media";
import { canAccessEventMediaPath } from "@/lib/storage/event-media-access";
import { createClient } from "@/lib/supabase/server";

export async function getEventMediaStorageProviderAction(): Promise<{
  provider: StorageProvider;
}> {
  return { provider: getEventMediaStorageProvider() };
}

export async function uploadEventMediaObjectAction(formData: FormData): Promise<{
  error: string | null;
  provider?: StorageProvider;
  url?: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const path = String(formData.get("path") ?? "").trim();
  const file = formData.get("file");
  if (!path || !(file instanceof File)) {
    return { error: "Missing file or storage path." };
  }
  if (!path.startsWith(`${user.id}/`)) {
    return { error: "Invalid storage path." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await uploadEventMediaObject({
    supabase,
    path,
    bytes,
    contentType: file.type || undefined,
  });

  if (result.error) return { error: result.error };
  return {
    error: null,
    provider: result.provider,
    url: result.url,
  };
}

export async function removeEventMediaObjectAction(
  path: string,
  provider?: StorageProvider | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const clean = path.trim().replace(/^\//, "");
  if (!clean.startsWith(`${user.id}/`)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return { error: "You can only remove your own media objects." };
    }
  }

  try {
    await deleteEventMediaObject({
      supabase,
      path: clean,
      provider: provider ?? null,
    });
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not delete media object.",
    };
  }
}

export async function getEventMediaAccessUrlAction(
  path: string,
  provider?: StorageProvider | null,
  expiresIn = 3600,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "You must be signed in." };

  const clean = path.trim().replace(/^\//, "");
  if (!(await canAccessEventMediaPath(supabase, user.id, clean))) {
    return { url: null, error: "You do not have access to this media." };
  }

  return getEventMediaAccessUrl({
    supabase,
    path: clean,
    provider: provider ?? null,
    expiresIn,
  });
}
