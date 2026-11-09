"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Persist a For You dismissal (e.g. monthly trophy card after Hall of Fame). */
export async function dismissForYouKeyAction(
  dismissKey: string,
): Promise<{ error: string | null }> {
  const key = dismissKey.trim();
  if (!key || key.length > 120) {
    return { error: "Invalid dismissal key." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("hub_foryou_dismissals").upsert(
    {
      user_id: user.id,
      dismiss_key: key,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,dismiss_key" },
  );

  if (error) {
    if (/hub_foryou_dismissals|relation|does not exist/i.test(error.message)) {
      return {
        error:
          "For You dismissals need migration 093_foryou_dismissals.sql in Supabase.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/for-you");
  revalidatePath("/");
  return { error: null };
}
