import { redirect } from "next/navigation";
import { VendorsClient } from "@/components/vendors/vendors-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { Vendor, VendorAuditEvent, VendorDeleteRequest } from "@/lib/vendors/types";

export default async function VendorsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: vendorRows, error } = await supabase
    .from("vendors")
    .select("*")
    .order("preferred", { ascending: false })
    .order("company_name", { ascending: true });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Vendors needs a database update</p>
        <p className="mt-2">
          Run migration <code>120_vendors.sql</code> in Supabase, then refresh. (
          {error.message})
        </p>
      </div>
    );
  }

  const vendors = (vendorRows ?? []) as Vendor[];

  const { data: deleteRows } = await supabase
    .from("vendor_delete_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const requesterIds = Array.from(
    new Set(
      (deleteRows ?? [])
        .map((r) => String(r.requested_by ?? ""))
        .filter(Boolean),
    ),
  );
  const vendorIds = Array.from(
    new Set(
      (deleteRows ?? []).map((r) => String(r.vendor_id ?? "")).filter(Boolean),
    ),
  );
  const [{ data: requesters }, { data: vendorNames }] = await Promise.all([
    requesterIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", requesterIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    vendorIds.length
      ? supabase.from("vendors").select("id, company_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
  ]);
  const requesterName = new Map(
    (requesters ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]),
  );
  const vendorName = new Map(
    (vendorNames ?? []).map((v) => [String(v.id), String(v.company_name ?? "")]),
  );

  const deleteRequests = (deleteRows ?? []).map((row) => {
    const r = row as VendorDeleteRequest;
    return {
      ...r,
      company_name: vendorName.get(String(r.vendor_id)) ?? undefined,
      requester_name: requesterName.get(String(r.requested_by ?? "")) || undefined,
    };
  });

  let auditEvents: Array<VendorAuditEvent & { actor_name?: string }> = [];
  if (isAdmin) {
    const { data: auditRows } = await supabase
      .from("vendor_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    const actorIds = Array.from(
      new Set(
        (auditRows ?? [])
          .map((r) => String(r.actor_id ?? ""))
          .filter(Boolean),
      ),
    );
    const { data: actors } = actorIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
    const actorName = new Map(
      (actors ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]),
    );
    auditEvents = (auditRows ?? []).map((row) => {
      const r = row as VendorAuditEvent;
      return {
        ...r,
        actor_name: actorName.get(String(r.actor_id ?? "")) || undefined,
      };
    });
  }

  return (
    <VendorsClient
      vendors={vendors}
      deleteRequests={deleteRequests}
      auditEvents={auditEvents}
      isAdmin={isAdmin}
    />
  );
}
