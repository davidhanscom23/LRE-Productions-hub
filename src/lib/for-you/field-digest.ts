import "server-only";

import { sendEmailDetailed, isEmailConfigured } from "@/lib/email/send";
import { getForYouQueue } from "@/lib/for-you/queue";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types/database";
import { normalizeDepartments } from "@/lib/types/database";

export type FieldDigestResult = {
  ran: boolean;
  examined: number;
  emailed: number;
  skipped: number;
  error: string | null;
};

function formatDigestBody(
  name: string,
  queue: Awaited<ReturnType<typeof getForYouQueue>>,
): string {
  const lines: string[] = [
    `Hi ${name.split(" ")[0] || name},`,
    "",
    `You have ${queue.totalActionable} item${queue.totalActionable === 1 ? "" : "s"} waiting on you in the Hub (For You).`,
    "",
  ];
  for (const section of queue.sections.filter((s) => s.actionable !== false)) {
    if (section.items.length === 0) continue;
    lines.push(`${section.title}:`);
    for (const item of section.items.slice(0, 5)) {
      lines.push(`  • ${item.label}${item.sub ? ` (${item.sub})` : ""}`);
    }
    if (section.items.length > 5) {
      lines.push(`  • …and ${section.items.length - 5} more`);
    }
    lines.push("");
  }
  lines.push("Open For You in the Hub to clear them.");
  lines.push("");
  lines.push("— Vident Productions Hub");
  return lines.join("\n");
}

/**
 * Daily Field digest: email each non-guest staffer with actionable For You items.
 * Requires RESEND + service role. Always sends when actionable > 0 (no prefs migration).
 */
export async function runFieldDigestEmails(): Promise<FieldDigestResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ran: false,
      examined: 0,
      emailed: 0,
      skipped: 0,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required for the Field digest cron.",
    };
  }
  if (!isEmailConfigured()) {
    return {
      ran: false,
      examined: 0,
      emailed: 0,
      skipped: 0,
      error: "RESEND_API_KEY and EMAIL_FROM are required for Field digest emails.",
    };
  }

  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, avatar_url, departments, title, phone, birthday, start_date, bio, facebook_url, instagram_url, linkedin_url, twitter_url, is_active, color, reports_to, theme_preference, created_at, updated_at",
    )
    .eq("is_active", true)
    .neq("role", "guest")
    .order("full_name", { ascending: true });

  if (error) {
    return {
      ran: false,
      examined: 0,
      emailed: 0,
      skipped: 0,
      error: error.message,
    };
  }

  const profiles = (rows ?? []) as Profile[];
  let emailed = 0;
  let skipped = 0;

  for (const raw of profiles) {
    const profile: Profile = {
      ...raw,
      departments: normalizeDepartments(raw.departments),
    };
    if (!profile.email?.trim()) {
      skipped += 1;
      continue;
    }

    try {
      const queue = await getForYouQueue(profile, supabase);
      if (queue.totalActionable <= 0) {
        skipped += 1;
        continue;
      }
      const result = await sendEmailDetailed({
        to: profile.email,
        subject: `For You — ${queue.totalActionable} waiting in the Hub`,
        text: formatDigestBody(profile.full_name || "teammate", queue),
      });
      if (result.ok) emailed += 1;
      else skipped += 1;
    } catch (err) {
      console.error("[field-digest]", profile.id, err);
      skipped += 1;
    }
  }

  return {
    ran: true,
    examined: profiles.length,
    emailed,
    skipped,
    error: null,
  };
}
