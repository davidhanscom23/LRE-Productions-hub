import "server-only";

import { executeDraftPublish } from "@/lib/marketing/publish-draft";
import { notifyAdmins } from "@/lib/notifications/notify";
import {
  apiPublishablePlatforms,
  canPublishViaApi,
  isAnySocialApiConfigured,
} from "@/lib/social/publishable-platforms";
import type { SocialPlatform } from "@/lib/social/platforms";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export type AutoPublishDueResult = {
  ran: boolean;
  examined: number;
  published: number;
  failed: number;
  skipped: number;
  error: string | null;
  failures: { draftId: string; platform: string; error: string }[];
};

/**
 * Publish due API-backed drafts that are already `ready`
 * (admin-approved / admin-scheduled). Never touches pending_approval.
 * Covers Facebook, Instagram, and LinkedIn when configured.
 */
export async function runDueSocialAutoPublish(): Promise<AutoPublishDueResult> {
  const empty: AutoPublishDueResult = {
    ran: false,
    examined: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    error: null,
    failures: [],
  };

  if (!isServiceRoleConfigured()) {
    return {
      ...empty,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required for the due-posts publish cron.",
    };
  }

  const platforms = apiPublishablePlatforms();
  if (!isAnySocialApiConfigured() || platforms.length === 0) {
    return {
      ...empty,
      ran: true,
      skipped: 0,
      error: null,
    };
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: drafts, error } = await supabase
    .from("social_post_drafts")
    .select("id, platform, scheduled_for, status")
    .eq("status", "ready")
    .in("platform", platforms)
    .not("scheduled_for", "is", null)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(25);

  if (error) {
    return { ...empty, error: error.message };
  }

  const rows = drafts ?? [];
  let published = 0;
  let failed = 0;
  let skipped = 0;
  const failures: AutoPublishDueResult["failures"] = [];

  for (const row of rows) {
    const platform = row.platform as SocialPlatform;
    if (!canPublishViaApi(platform)) {
      skipped += 1;
      continue;
    }

    const result = await executeDraftPublish({
      supabase,
      draftId: row.id as string,
      reviewerId: null,
      useApiPublish: true,
      notesPrefix: "Auto-published on schedule. ",
    });

    if (result.error) {
      failed += 1;
      failures.push({
        draftId: row.id as string,
        platform,
        error: result.error,
      });
      continue;
    }
    published += 1;
  }

  if (failures.length) {
    const preview = failures
      .slice(0, 3)
      .map((item) => `${item.platform}: ${item.error}`)
      .join(" · ");
    await notifyAdmins(supabase, {
      kind: "marketing_autopublish_failed",
      title: "Scheduled social publish had errors",
      body: `${failures.length} draft(s) failed. ${preview}`,
      href: "/marketing?filter=due",
    });
  }

  return {
    ran: true,
    examined: rows.length,
    published,
    failed,
    skipped,
    error: null,
    failures,
  };
}
