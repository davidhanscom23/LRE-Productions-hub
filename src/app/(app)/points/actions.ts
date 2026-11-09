"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGuestRole } from "@/lib/auth/guest";
import {
  adminGrantPoints,
  awardAchievement,
  discoverPath,
  runDailyCheckin,
  type AwardResult,
  type CheckinResult,
} from "@/lib/points/hub-points";
import { createClient } from "@/lib/supabase/server";

export async function dailyCheckinAction(): Promise<CheckinResult> {
  const profile = await getCurrentProfile();
  if (!profile || isGuestRole(profile.role)) {
    return {
      ok: false,
      streak: 0,
      points: 0,
      awarded: [],
      message: "Sign in as staff to earn points.",
    };
  }
  const supabase = await createClient();
  return runDailyCheckin(supabase);
}

export async function discoverPathAction(
  path: string,
): Promise<AwardResult> {
  const profile = await getCurrentProfile();
  if (!profile || isGuestRole(profile.role)) {
    return { awarded: false, points: 0, message: "Guests cannot earn points." };
  }
  const supabase = await createClient();
  return discoverPath(supabase, path);
}

export async function awardFirstKudosAction(): Promise<AwardResult> {
  const profile = await getCurrentProfile();
  if (!profile || isGuestRole(profile.role)) {
    return { awarded: false, points: 0 };
  }
  const supabase = await createClient();
  return awardAchievement(supabase, "first_kudos_given");
}

export async function adminGrantPointsAction(input: {
  userId: string;
  points: number;
  reason: string;
}): Promise<{ error: string | null; message?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Admins only." };
  }

  const userId = input.userId?.trim();
  const points = Math.trunc(Number(input.points));
  const reason = input.reason?.trim();
  if (!userId) return { error: "Pick a teammate." };
  if (!reason) return { error: "Add a reason for the award." };
  if (!Number.isFinite(points) || points === 0) {
    return { error: "Enter a non-zero point amount." };
  }
  if (Math.abs(points) > 100000) {
    return { error: "That amount is too large." };
  }

  const supabase = await createClient();
  const result = await adminGrantPoints(supabase, userId, points, reason);
  if (!result.ok) {
    return { error: result.message ?? "Could not grant points." };
  }

  revalidatePath("/");
  revalidatePath("/people");
  return {
    error: null,
    message: `${points > 0 ? "+" : ""}${points} pts → ${result.userName} (total ${result.total}).`,
  };
}
