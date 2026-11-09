"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Revoke the old subscription link and issue a new one for the current user.
 * Runs as the signed-in user (not the service role) so the profiles self-edit
 * trigger allows it — calendar_feed_token is not a guarded column, and this is
 * the user editing their own row.
 */
export async function rotateFeedTokenAction(): Promise<{
  token: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { token: null };

  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await supabase
    .from("profiles")
    .update({ calendar_feed_token: token })
    .eq("id", user.id)
    .select("calendar_feed_token")
    .maybeSingle();
  if (error) return { token: null };

  revalidatePath("/my-calendar");
  return { token: (data?.calendar_feed_token as string) ?? null };
}
