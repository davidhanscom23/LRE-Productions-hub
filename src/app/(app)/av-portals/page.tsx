import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/admin";
import { canAccessVidentAv } from "@/lib/vident-av-access";
import { computeStatus, type PortalValues } from "@/lib/av-portals/items";
import { daysUntil, todayInEastern } from "@/lib/av-portals/cadence";
import { formatEventDate, showFileNumber } from "@/lib/av-portals/emails";
import type { PortalRow } from "@/lib/av-portals/server";
import { AvPortalsList, type PortalListRow } from "@/components/av-portal-admin/av-portals-list";

export const metadata = { title: "AV Event Portals" };
export const dynamic = "force-dynamic";

export default async function AvPortalsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("av_event_portals")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">AV Event Portals needs a database update</p>
        <p className="mt-2">
          Run migration <code>139_av_event_portals.sql</code> in Supabase, then refresh. ({error.message})
        </p>
      </div>
    );
  }

  const portals = (data ?? []) as PortalRow[];
  const ids = portals.map((p) => p.id);
  const [{ data: vals }, { data: files }] = ids.length
    ? await Promise.all([
        supabase.from("av_event_portal_values").select("portal_id, item_key, value").in("portal_id", ids),
        supabase.from("av_event_portal_files").select("id, portal_id, item_key, file_name").in("portal_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const today = todayInEastern();
  const rows: PortalListRow[] = portals.map((p) => {
    const values: PortalValues = {};
    for (const v of (vals ?? []) as { portal_id: string; item_key: string; value: unknown }[]) {
      if (v.portal_id === p.id) (values as Record<string, unknown>)[v.item_key] = v.value;
    }
    const pf = ((files ?? []) as { id: string; portal_id: string; item_key: never; file_name: string }[]).filter(
      (f) => f.portal_id === p.id,
    );
    const status = computeStatus(values, pf);
    return {
      id: p.id,
      eventName: p.event_name,
      clientName: p.client_name,
      clientEmail: p.client_email,
      dateLabel: formatEventDate(p.event_date),
      daysOut: daysUntil(p.event_date, today),
      venue: p.venue_name,
      fileNo: showFileNumber(p),
      token: p.token,
      isActive: p.is_active,
      done: status.completeCount,
      total: status.total,
      lastActivity: p.last_client_activity_at,
    };
  });

  return <AvPortalsList rows={rows} />;
}
