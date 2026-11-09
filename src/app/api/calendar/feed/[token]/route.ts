import { getStaffFeedIcsByToken } from "@/lib/calendar/staff-feed";

/**
 * Public, token-authenticated iCal feed for one staff member.
 * Google Calendar ("From URL") and Apple Calendar ("New Subscription") fetch
 * this without a login — the long random token in the path is the key. Read-only.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const clean = (token || "").replace(/\.ics$/i, "");

  let ics: string | null = null;
  try {
    ics = await getStaffFeedIcsByToken(clean);
  } catch {
    ics = null;
  }
  if (ics === null) {
    return new Response("Calendar not found", { status: 404 });
  }
  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="vident-productions.ics"',
      "cache-control": "public, max-age=1800",
    },
  });
}
