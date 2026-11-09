import { headers } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getMyFeedToken } from "@/lib/calendar/staff-feed";
import { MyCalendarClient } from "@/components/calendar/my-calendar-client";

export const dynamic = "force-dynamic";

export default async function MyCalendarPage() {
  const profile = await getCurrentProfile();
  const token = profile ? await getMyFeedToken(profile.id) : null;

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-[var(--foreground)]">
        My Calendar
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Subscribe to your events in Google or Apple Calendar. The link is private
        to you and read-only.
      </p>
      <MyCalendarClient origin={origin} token={token} />
    </div>
  );
}
