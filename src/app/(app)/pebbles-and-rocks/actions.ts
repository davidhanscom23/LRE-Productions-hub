"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GoalKind, GoalStatus } from "@/lib/types/quarterly-goals";

const STATUSES: GoalStatus[] = ["not_started", "on_track", "at_risk", "done"];

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, isAdmin: profile?.role === "admin" };
}

export async function createGoalAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const { supabase, user, isAdmin } = await getContext();
  if (!user) return { error: "You must be signed in." };

  const userId = String(formData.get("user_id") ?? "").trim();
  const year = Number(formData.get("year") ?? 0);
  const quarter = Number(formData.get("quarter") ?? 0);
  const kind = String(formData.get("kind") ?? "") as GoalKind;
  const title = String(formData.get("title") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();

  if (!userId) return { error: "Missing person." };
  if (!isAdmin && userId !== user.id) {
    return { error: "You can only add to your own board." };
  }
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return { error: "Invalid year." };
  }
  if (![1, 2, 3, 4].includes(quarter)) return { error: "Invalid quarter." };
  if (kind !== "rock" && kind !== "pebble") return { error: "Invalid type." };
  if (!title) return { error: "Title is required." };

  const { error } = await supabase.from("quarterly_goals").insert({
    user_id: userId,
    year,
    quarter,
    kind,
    title,
    detail,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/pebbles-and-rocks");
  return { error: null };
}

export async function setGoalStatusAction(
  id: string,
  status: GoalStatus,
): Promise<{ error: string | null }> {
  const { supabase, user } = await getContext();
  if (!user) return { error: "You must be signed in." };
  if (!STATUSES.includes(status)) return { error: "Invalid status." };

  const { error } = await supabase
    .from("quarterly_goals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/pebbles-and-rocks");
  return { error: null };
}

export async function deleteGoalAction(
  id: string,
): Promise<{ error: string | null }> {
  const { supabase, user } = await getContext();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("quarterly_goals").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/pebbles-and-rocks");
  return { error: null };
}
