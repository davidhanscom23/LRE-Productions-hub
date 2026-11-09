import "server-only";

import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InviteStaffResult = {
  profileId: string | null;
  invited: boolean;
  alreadyExisted: boolean;
  error: string | null;
};

/**
 * Resolve an existing Hub profile by email, or invite via Auth admin API.
 * Uses service role. Profile row is created by handle_new_user on invite.
 */
export async function inviteOrLinkStaffByEmail(options: {
  supabase: SupabaseClient;
  email: string;
  fullName: string;
  /** When false, only link an existing profile — never invite. Default true. */
  inviteIfMissing?: boolean;
  redirectTo?: string;
}): Promise<InviteStaffResult> {
  const email = options.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return {
      profileId: null,
      invited: false,
      alreadyExisted: false,
      error: "A valid email is required to invite or link a Hub account.",
    };
  }

  const { data: existing } = await options.supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (existing?.id) {
    return {
      profileId: existing.id as string,
      invited: false,
      alreadyExisted: true,
      error: null,
    };
  }

  if (options.inviteIfMissing === false) {
    return {
      profileId: null,
      invited: false,
      alreadyExisted: false,
      error: null,
    };
  }

  if (!isServiceRoleConfigured()) {
    return {
      profileId: null,
      invited: false,
      alreadyExisted: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required to send Hub invites from Hiring.",
    };
  }

  try {
    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: options.fullName.trim().slice(0, 200),
        role: "staff",
      },
      ...(options.redirectTo
        ? { redirectTo: options.redirectTo }
        : {}),
    });

    if (error) {
      // Already registered in Auth but profile lookup missed — try again.
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        const { data: again } = await options.supabase
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (again?.id) {
          return {
            profileId: again.id as string,
            invited: false,
            alreadyExisted: true,
            error: null,
          };
        }
      }
      return {
        profileId: null,
        invited: false,
        alreadyExisted: false,
        error: error.message,
      };
    }

    const userId = data.user?.id ?? null;
    if (!userId) {
      return {
        profileId: null,
        invited: true,
        alreadyExisted: false,
        error: "Invite sent but no user id returned.",
      };
    }

    // Ensure profile has the hire name (trigger may have used empty meta).
    await options.supabase
      .from("profiles")
      .update({
        full_name: options.fullName.trim().slice(0, 200),
        role: "staff",
      })
      .eq("id", userId);

    return {
      profileId: userId,
      invited: true,
      alreadyExisted: false,
      error: null,
    };
  } catch (err) {
    return {
      profileId: null,
      invited: false,
      alreadyExisted: false,
      error: err instanceof Error ? err.message : "Invite failed.",
    };
  }
}
