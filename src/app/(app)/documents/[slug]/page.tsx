import type { HandbookRosterRow } from "@/components/handbook/handbook-ack-roster";
import { AgreementPageClient } from "@/components/documents/agreement-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGuestRole } from "@/lib/auth/guest";
import { isAgreementDocumentKey } from "@/lib/documents/catalog";
import {
  canViewAgreement,
  getAgreementDocument,
} from "@/lib/documents/settings";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function DocumentAgreementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (isGuestRole(profile.role)) redirect("/");

  const { slug } = await params;
  if (!isAgreementDocumentKey(slug)) notFound();

  const isAdmin = profile.role === "admin";
  const canView = await canViewAgreement(slug, isAdmin);
  if (!canView) redirect("/documents");

  const doc = await getAgreementDocument(slug);
  const supabase = await createClient();
  const revision = doc.isDraft ? "draft" : "live";
  const canTrackAcks =
    profile.role === "admin" || profile.role === "trainer";

  const { data: acknowledgement, error: ackError } = await supabase
    .from("hub_document_acknowledgements")
    .select("id")
    .eq("user_id", profile.id)
    .eq("document_key", slug)
    .eq("document_revision", revision)
    .maybeSingle();

  const alreadySigned = !ackError && Boolean(acknowledgement?.id);

  let rosterRows: HandbookRosterRow[] = [];
  if (canTrackAcks) {
    const [{ data: staffRows }, { data: ackRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .neq("role", "guest")
        .order("full_name", { ascending: true }),
      supabase
        .from("hub_document_acknowledgements")
        .select("user_id, signed_at")
        .eq("document_key", slug)
        .eq("document_revision", revision),
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
    <AgreementPageClient
      content={doc.content}
      isDraft={doc.isDraft}
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
