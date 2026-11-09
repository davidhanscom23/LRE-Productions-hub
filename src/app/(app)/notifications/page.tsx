import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";
import { listMyNotificationsAction } from "@/app/(app)/notifications/actions";

export default async function NotificationsPage() {
  const { notifications } = await listMyNotificationsAction(100);

  return <NotificationsPageClient initialNotifications={notifications} />;
}
