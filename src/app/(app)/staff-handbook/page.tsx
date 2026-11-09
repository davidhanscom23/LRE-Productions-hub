import type { HandbookRosterRow } from "@/components/handbook/handbook-ack-roster";
import { HandbookPageClient } from "@/components/handbook/handbook-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  canViewStaffHandbook,
  getHandbookDocument,
} from "@/lib/handbook/settings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StaffHandbookPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";
  const canTrackAcks =
    profile.role === "admin" || profile.role === "trainer";
  const canView = await canViewStaffHandbook(isAdmin);
  if (!canView) redirect("/");

  const handbook = await getHandbookDocument();
  const supabase = await createClient();
  const revision = handbook.isDraft ? "draft" : "live";

  const { data: acknowledgement, error: ackError } = await supabase
    .from("handbook_acknowledgements")
    .select("id")
    .eq("user_id", profile.id)
    .eq("handbook_revision", revision)
    .maybeSingle();

  // Before migration 022 the table may not exist yet — still show the handbook.
  const alreadySigned = !ackError && Boolean(acknowledgement?.id);

  let rosterRows: HandbookRosterRow[] = [];
  if (canTrackAcks) {
    const [{ data: staffRows }, { data: ackRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("handbook_acknowledgements")
        .select("user_id, signed_at")
        .eq("handbook_revision", revision),
    ]);

    const signedAtByUser = new Map<string, string>();
    for (const row of ackRows ?? []) {
      signedAtByUser.set(row.user_id as string, String(row.signed_at));
    }

    rosterRows = (staffRows ?? []).map((staff) => ({
      userId: staff.id as string,
      name: String(staff.full_name || staff.email || "Staff"),
      email: String(staff.email ?? ""),
      signedAt: signedAtByUser.get(staff.id as string) ?? null,
    }));

    rosterRows.sort((a, b) => {
      if (Boolean(a.signedAt) !== Boolean(b.signedAt)) {
        return a.signedAt ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  return (
    <HandbookPageClient
      content={handbook.content}
      isDraft={handbook.isDraft}
      isAdmin={isAdmin}
      canTrackAcks={canTrackAcks}
      alreadySigned={alreadySigned}
      defaultName={profile.full_name ?? ""}
      defaultEmail={profile.email ?? ""}
      rosterRevision={revision}
      rosterRows={rosterRows}
    />
  );
}
