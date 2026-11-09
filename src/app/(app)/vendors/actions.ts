"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { DEPARTMENTS, type Department } from "@/lib/types/database";
import { syncVendorsToSheet } from "@/lib/vendors/sheet-sync";
import type { Vendor } from "@/lib/vendors/types";
import { createClient } from "@/lib/supabase/server";
import { insertNotifications } from "@/lib/notifications/notify";

function normalizeDepartments(raw: unknown): Department[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is Department =>
    DEPARTMENTS.includes(d as Department),
  );
}

function snapshotVendor(row: Record<string, unknown>) {
  return {
    id: row.id,
    category: row.category,
    company_name: row.company_name,
    contact_name: row.contact_name,
    phone: row.phone,
    email: row.email,
    website: row.website,
    notes: row.notes,
    preferred: row.preferred,
    departments: row.departments,
  };
}

async function requireStaffUser() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) {
    return { supabase, profile: null, error: "You must be signed in." as const };
  }
  if (profile.role === "guest") {
    return {
      supabase,
      profile: null,
      error: "Guests cannot manage vendors." as const,
    };
  }
  return { supabase, profile, error: null };
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    vendorId: string | null;
    actorId: string;
    action: string;
    summary: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) {
  await supabase.from("vendor_audit_events").insert({
    vendor_id: input.vendorId,
    actor_id: input.actorId,
    action: input.action,
    summary: input.summary,
    before_row: input.before ?? null,
    after_row: input.after ?? null,
  });
}

async function pushVendorsSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data } = await supabase
    .from("vendors")
    .select("*")
    .order("company_name", { ascending: true });
  await syncVendorsToSheet(supabase, (data ?? []) as Vendor[]);
}

function parseVendorForm(formData: FormData) {
  const company_name = String(formData.get("company_name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const contact_name = String(formData.get("contact_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const website = String(formData.get("website") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const preferred = String(formData.get("preferred") ?? "") === "on";
  const departments = normalizeDepartments(
    formData.getAll("departments").map((v) => String(v)),
  );
  return {
    company_name,
    category,
    contact_name,
    phone,
    email,
    website,
    notes,
    preferred,
    departments,
  };
}

export async function createVendorAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const { supabase, profile, error } = await requireStaffUser();
  if (error || !profile) return { error: error ?? "Unauthorized" };

  const parsed = parseVendorForm(formData);
  if (!parsed.company_name) return { error: "Company name is required." };

  const { data, error: insertError } = await supabase
    .from("vendors")
    .insert({
      ...parsed,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("*")
    .single();

  if (insertError || !data) {
    return { error: insertError?.message ?? "Could not create vendor." };
  }

  await writeAudit(supabase, {
    vendorId: data.id as string,
    actorId: profile.id,
    action: "create",
    summary: `Created vendor ${parsed.company_name}`,
    after: snapshotVendor(data as Record<string, unknown>),
  });
  await pushVendorsSheet(supabase);
  revalidatePath("/vendors");
  revalidatePath("/ask");
  return { error: null };
}

export async function updateVendorAction(
  vendorId: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { supabase, profile, error } = await requireStaffUser();
  if (error || !profile) return { error: error ?? "Unauthorized" };

  const parsed = parseVendorForm(formData);
  if (!parsed.company_name) return { error: "Company name is required." };

  const { data: before } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .maybeSingle();
  if (!before) return { error: "Vendor not found." };

  const { data, error: updateError } = await supabase
    .from("vendors")
    .update({
      ...parsed,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vendorId)
    .select("*")
    .single();

  if (updateError || !data) {
    return { error: updateError?.message ?? "Could not update vendor." };
  }

  await writeAudit(supabase, {
    vendorId,
    actorId: profile.id,
    action: "update",
    summary: `Updated vendor ${parsed.company_name}`,
    before: snapshotVendor(before as Record<string, unknown>),
    after: snapshotVendor(data as Record<string, unknown>),
  });
  await pushVendorsSheet(supabase);
  revalidatePath("/vendors");
  revalidatePath("/ask");
  return { error: null };
}

export async function requestVendorDeleteAction(input: {
  vendorId: string;
  reason: string;
}): Promise<{ error: string | null }> {
  const { supabase, profile, error } = await requireStaffUser();
  if (error || !profile) return { error: error ?? "Unauthorized" };

  const reason = input.reason.trim();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, company_name")
    .eq("id", input.vendorId)
    .maybeSingle();
  if (!vendor) return { error: "Vendor not found." };

  if (profile.role === "admin") {
    return deleteVendorAsAdmin(supabase, profile.id, vendor.id as string, vendor.company_name as string, reason || "Admin delete");
  }

  const { error: reqError } = await supabase.from("vendor_delete_requests").insert({
    vendor_id: input.vendorId,
    requested_by: profile.id,
    reason,
    status: "pending",
  });
  if (reqError) {
    if (/duplicate|unique/i.test(reqError.message)) {
      return { error: "A delete request is already pending for this vendor." };
    }
    return { error: reqError.message };
  }

  await writeAudit(supabase, {
    vendorId: input.vendorId,
    actorId: profile.id,
    action: "delete_request",
    summary: `Requested delete for ${vendor.company_name}`,
    after: { reason },
  });

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  await insertNotifications(
    supabase,
    (admins ?? []).map((a) => ({
      userId: a.id as string,
      kind: "vendor_delete_request",
      title: "Vendor delete requested",
      body: `${profile.full_name || "Someone"} asked to delete ${vendor.company_name}.`,
      href: "/vendors",
    })),
  );

  revalidatePath("/vendors");
  revalidatePath("/for-you");
  return { error: null };
}

async function deleteVendorAsAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  vendorId: string,
  companyName: string,
  summary: string,
) {
  const { data: before } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .maybeSingle();
  if (!before) return { error: "Vendor not found." };

  const { error: delError } = await supabase
    .from("vendors")
    .delete()
    .eq("id", vendorId);
  if (delError) return { error: delError.message };

  await writeAudit(supabase, {
    vendorId,
    actorId,
    action: "delete",
    summary: summary || `Deleted vendor ${companyName}`,
    before: snapshotVendor(before as Record<string, unknown>),
  });
  await pushVendorsSheet(supabase);
  revalidatePath("/vendors");
  revalidatePath("/ask");
  return { error: null };
}

export async function reviewVendorDeleteRequestAction(input: {
  requestId: string;
  decision: "approved" | "declined";
  note?: string;
}): Promise<{ error: string | null }> {
  const { supabase, profile, error } = await requireStaffUser();
  if (error || !profile) return { error: error ?? "Unauthorized" };
  if (profile.role !== "admin") {
    return { error: "Only admins can approve or decline delete requests." };
  }

  const { data: req } = await supabase
    .from("vendor_delete_requests")
    .select("*, vendors(id, company_name)")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!req || req.status !== "pending") {
    return { error: "Pending delete request not found." };
  }

  const companyName =
    (req as { vendors?: { company_name?: string } }).vendors?.company_name ??
    "vendor";
  const note = (input.note ?? "").trim();

  if (input.decision === "declined") {
    await supabase
      .from("vendor_delete_requests")
      .update({
        status: "declined",
        reviewed_by: profile.id,
        review_note: note,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", input.requestId);
    await writeAudit(supabase, {
      vendorId: req.vendor_id as string,
      actorId: profile.id,
      action: "delete_decline",
      summary: `Declined delete for ${companyName}`,
      after: { note },
    });
    if (req.requested_by) {
      await insertNotifications(supabase, [
        {
          userId: req.requested_by as string,
          kind: "vendor_delete_review",
          title: "Vendor delete declined",
          body: `Your request to delete ${companyName} was declined.`,
          href: "/vendors",
        },
      ]);
    }
    revalidatePath("/vendors");
    return { error: null };
  }

  const del = await deleteVendorAsAdmin(
    supabase,
    profile.id,
    req.vendor_id as string,
    companyName,
    `Approved delete for ${companyName}`,
  );
  if (del.error) return del;

  await supabase
    .from("vendor_delete_requests")
    .update({
      status: "approved",
      reviewed_by: profile.id,
      review_note: note,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.requestId);

  await writeAudit(supabase, {
    vendorId: req.vendor_id as string,
    actorId: profile.id,
    action: "delete_approve",
    summary: `Approved delete for ${companyName}`,
    after: { note },
  });

  if (req.requested_by) {
    await insertNotifications(supabase, [
      {
        userId: req.requested_by as string,
        kind: "vendor_delete_review",
        title: "Vendor delete approved",
        body: `${companyName} was removed from Vendors.`,
        href: "/vendors",
      },
    ]);
  }

  revalidatePath("/vendors");
  return { error: null };
}

export async function syncVendorsSheetNowAction(): Promise<{
  error: string | null;
}> {
  const { supabase, profile, error } = await requireStaffUser();
  if (error || !profile) return { error: error ?? "Unauthorized" };
  if (profile.role !== "admin") {
    return { error: "Only admins can force a sheet sync." };
  }
  await pushVendorsSheet(supabase);
  revalidatePath("/vendors");
  return { error: null };
}
