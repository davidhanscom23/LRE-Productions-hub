"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { KUDO_VALUES, type KudoValue } from "@/lib/types/kudos";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const VALID_VALUE = new Set<KudoValue>([
  "",
  ...KUDO_VALUES.map((v) => v.value),
]);

export async function giveKudosAction(input: {
  toUser: string;
  message: string;
  value: string;
}): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const toUser = input.toUser?.trim();
  if (!toUser) return { error: "Pick a teammate to recognize." };
  if (toUser === profile.id) return { error: "Give kudos to a teammate, not yourself." };
  const message = (input.message ?? "").trim();
  if (!message) return { error: "Add a short message." };
  const value = (VALID_VALUE.has(input.value as KudoValue)
    ? input.value
    : "") as KudoValue;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("kudos")
    .insert({
      from_user: profile.id,
      to_user: toUser,
      message: message.slice(0, 600),
      value,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  try {
    await supabase.rpc("notify_kudos_recipient", { p_kudo_id: created.id });
  } catch {
    // non-critical
  }

  try {
    await supabase.rpc("award_hub_achievement", {
      p_key: "first_kudos_given",
      p_meta: { kudo_id: created.id },
    });
  } catch {
    // points optional until migration 075 is applied
  }

  revalidatePath("/kudos");
  revalidatePath("/");
  return { error: null };
}

export async function deleteKudosAction(id: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  const supabase = await createClient();
  const { error } = await supabase.from("kudos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/kudos");
  return { error: null };
}
