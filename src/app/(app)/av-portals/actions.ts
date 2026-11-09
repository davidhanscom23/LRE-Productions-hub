"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/admin";
import { canAccessVidentAv } from "@/lib/vident-av-access";
import {
  PORTAL_BUCKET,
  fetchPortalById,
  fetchPortalState,
  newPortalToken,
  sendPortalEmail,
} from "@/lib/av-portals/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function gate() {
  const profile = await getCurrentProfile();
  return profile && canAccessVidentAv(profile) ? profile : null;
}

export type PortalInput = {
  eventName: string;
  clientName: string;
  clientEmail: string;
  ccEmails: string;
  eventDate: string;
  venueName: string;
  loadInTime: string;
  note: string;
};

function validate(input: PortalInput): { error: string } | { row: Record<string, unknown> } {
  const eventName = input.eventName.trim();
  const clientEmail = input.clientEmail.trim().toLowerCase();
  const cc = input.ccEmails
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!eventName) return { error: "Event name is required." };
  if (!EMAIL_RE.test(clientEmail)) return { error: "Enter a valid client email." };
  if (cc.some((e) => !EMAIL_RE.test(e))) return { error: "One of the CC emails is not valid." };
  if (!DATE_RE.test(input.eventDate)) return { error: "Choose the event date." };
  return {
    row: {
      event_name: eventName.slice(0, 160),
      client_name: input.clientName.trim().slice(0, 120),
      client_email: clientEmail,
      cc_emails: cc.slice(0, 8),
      event_date: input.eventDate,
      venue_name: input.venueName.trim().slice(0, 160),
      load_in_time: input.loadInTime.trim().slice(0, 60),
      note_to_client: input.note.trim().slice(0, 1000),
    },
  };
}

export async function createPortalAction(
  input: PortalInput & { sendNow: boolean },
): Promise<ActionResult<{ id: string }>> {
  const profile = await gate();
  if (!profile) return fail("You do not have access to Vident AV.");
  const v = validate(input);
  if ("error" in v) return fail(v.error);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("av_event_portals")
    .insert({ ...v.row, token: newPortalToken(), created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) {
    return fail(
      error?.message.includes("av_event_portals")
        ? "AV event portals need a database update (run migration 139), then try again."
        : "Could not create the portal.",
    );
  }
  revalidatePath("/av-portals");

  if (input.sendNow) {
    const portal = await fetchPortalById(data.id as string);
    if (portal) {
      const { status } = await fetchPortalState(portal.id);
      const res = await sendPortalEmail(portal, "manual", status);
      if (!res.ok) {
        return { ok: true, data: { id: data.id as string } };
      }
    }
  }
  return { ok: true, data: { id: data.id as string } };
}

export async function updatePortalAction(id: string, input: PortalInput): Promise<ActionResult> {
  if (!(await gate())) return fail("You do not have access to Vident AV.");
  const v = validate(input);
  if ("error" in v) return fail(v.error);
  const { error } = await createServiceClient().from("av_event_portals").update(v.row).eq("id", id);
  if (error) return fail("Could not save changes.");
  revalidatePath("/av-portals");
  revalidatePath(`/av-portals/${id}`);
  return { ok: true };
}

export async function setPortalActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!(await gate())) return fail("You do not have access to Vident AV.");
  const { error } = await createServiceClient().from("av_event_portals").update({ is_active: active }).eq("id", id);
  if (error) return fail("Could not update the portal.");
  revalidatePath("/av-portals");
  revalidatePath(`/av-portals/${id}`);
  return { ok: true };
}

export async function sendCheckinNowAction(id: string): Promise<ActionResult> {
  if (!(await gate())) return fail("You do not have access to Vident AV.");
  const portal = await fetchPortalById(id);
  if (!portal) return fail("Portal not found.");
  const { status } = await fetchPortalState(id);
  const res = await sendPortalEmail(portal, "manual", status);
  if (!res.ok) {
    return fail(res.skipped ? "Email is not configured (RESEND_API_KEY / EMAIL_FROM)." : res.error ?? "Send failed.");
  }
  revalidatePath(`/av-portals/${id}`);
  return { ok: true };
}

export async function deletePortalFileAction(portalId: string, fileId: string): Promise<ActionResult> {
  if (!(await gate())) return fail("You do not have access to Vident AV.");
  const supabase = createServiceClient();
  const { data: file } = await supabase
    .from("av_event_portal_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .eq("portal_id", portalId)
    .maybeSingle();
  if (!file) return fail("File not found.");
  await supabase.storage.from(PORTAL_BUCKET).remove([file.storage_path as string]);
  await supabase.from("av_event_portal_files").delete().eq("id", fileId);
  revalidatePath(`/av-portals/${portalId}`);
  return { ok: true };
}

export async function deletePortalAction(id: string): Promise<ActionResult> {
  const profile = await gate();
  if (!profile) return fail("You do not have access to Vident AV.");
  const supabase = createServiceClient();
  const { data: files } = await supabase
    .from("av_event_portal_files")
    .select("storage_path")
    .eq("portal_id", id);
  const paths = (files ?? []).map((f: { storage_path: string }) => f.storage_path);
  if (paths.length) await supabase.storage.from(PORTAL_BUCKET).remove(paths);
  const { error } = await supabase.from("av_event_portals").delete().eq("id", id);
  if (error) return fail("Could not delete the portal.");
  revalidatePath("/av-portals");
  return { ok: true };
}
