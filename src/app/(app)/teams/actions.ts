"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TEAM_DEPARTMENTS,
  type DepartmentLinkInput,
  type DepartmentVideoInput,
  type TeamDepartment,
} from "@/lib/types/teams";

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

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    return {
      supabase,
      user: null,
      error: "Only trainers and admins can manage Teams content." as const,
    };
  }

  return { supabase, user, error: null as string | null };
}

function assertDepartment(value: string): value is TeamDepartment {
  return (TEAM_DEPARTMENTS as readonly string[]).includes(value);
}

export async function upsertDepartmentLinkAction(
  input: DepartmentLinkInput & { id?: string },
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireTrainerOrAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  if (!assertDepartment(input.department)) {
    return { error: "Invalid department." };
  }
  const title = input.title.trim();
  const url = input.url.trim();
  if (!title) return { error: "Title is required." };
  if (!url) return { error: "URL is required." };
  try {
    new URL(url);
  } catch {
    return { error: "Enter a valid URL (include https://)." };
  }

  const payload = {
    department: input.department,
    title,
    url,
    description: input.description.trim(),
    created_by: user.id,
  };

  if (input.id) {
    const { error: updateError } = await supabase
      .from("department_links")
      .update({
        department: payload.department,
        title: payload.title,
        url: payload.url,
        description: payload.description,
      })
      .eq("id", input.id);
    if (updateError) return { error: updateError.message };
  } else {
    const { error: insertError } = await supabase
      .from("department_links")
      .insert(payload);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/teams");
  return { error: null };
}

export async function deleteDepartmentLinkAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireTrainerOrAdmin();
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from("department_links")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };
  revalidatePath("/teams");
  return { error: null };
}

export async function upsertDepartmentVideoAction(
  input: DepartmentVideoInput & { id?: string },
): Promise<{ error: string | null }> {
  const { supabase, user, error } = await requireTrainerOrAdmin();
  if (error || !user) return { error: error ?? "Unauthorized" };

  if (!assertDepartment(input.department)) {
    return { error: "Invalid department." };
  }
  const title = input.title.trim();
  const video_url = input.video_url.trim();
  if (!title) return { error: "Title is required." };
  if (!video_url) return { error: "Video URL is required." };
  try {
    new URL(video_url);
  } catch {
    return { error: "Enter a valid video URL (include https://)." };
  }

  const payload = {
    department: input.department,
    title,
    description: input.description.trim(),
    video_url,
    category: input.category.trim(),
    thumbnail_url: input.thumbnail_url.trim(),
    created_by: user.id,
  };

  if (input.id) {
    const { error: updateError } = await supabase
      .from("department_videos")
      .update({
        department: payload.department,
        title: payload.title,
        description: payload.description,
        video_url: payload.video_url,
        category: payload.category,
        thumbnail_url: payload.thumbnail_url,
      })
      .eq("id", input.id);
    if (updateError) return { error: updateError.message };
  } else {
    const { error: insertError } = await supabase
      .from("department_videos")
      .insert(payload);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/teams");
  return { error: null };
}

export async function deleteDepartmentVideoAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, error } = await requireTrainerOrAdmin();
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from("department_videos")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: deleteError.message };
  revalidatePath("/teams");
  return { error: null };
}
