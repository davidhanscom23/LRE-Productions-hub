import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Web push fan-out. VAPID keys come from env:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — also used by the browser to subscribe
 *   VAPID_PRIVATE_KEY             — server only
 *   VAPID_SUBJECT                 — a mailto: or https: contact (optional)
 * With no keys set, everything no-ops (in-app notifications still work).
 */

let vapidReady = false;

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:hello@lreproductions.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    vapidReady = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; href?: string };

/** Send a push to every subscription belonging to the given users. */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapid()) return;
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return;

  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", unique);
  if (!subs || subs.length === 0) return;

  // Per-user unread counts so devices can show an accurate app-icon badge.
  const badgeByUser = new Map<string, number>();
  try {
    const { data: unreadRows } = await supabase
      .from("hub_notifications")
      .select("user_id")
      .in("user_id", unique)
      .is("read_at", null);
    for (const row of unreadRows ?? []) {
      const id = row.user_id as string;
      badgeByUser.set(id, (badgeByUser.get(id) ?? 0) + 1);
    }
  } catch {
    // badge is a nice-to-have — never block the push on it
  }

  await Promise.allSettled(
    subs.map(async (s) => {
      const data = JSON.stringify({
        title: payload.title,
        body: payload.body,
        href: payload.href ?? "/",
        badge: badgeByUser.get(s.user_id as string) ?? 0,
      });
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          data,
        );
      } catch (err) {
        // 404/410 mean the subscription is dead — prune it.
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }),
  );
}
