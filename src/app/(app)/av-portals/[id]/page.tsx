import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/admin";
import { canAccessVidentAv } from "@/lib/vident-av-access";
import { FILE_KEY_LABEL } from "@/lib/av-portals/items";
import { formatEventDate, portalUrl, showFileNumber } from "@/lib/av-portals/emails";
import { PORTAL_BUCKET, fetchPortalById, fetchPortalState } from "@/lib/av-portals/server";
import { DeleteFileButton, PortalDetailActions } from "@/components/av-portal-admin/portal-detail-actions";

export const metadata = { title: "AV Event Portal" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AvPortalDetailPage({ params }: Props) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/");

  const portal = await fetchPortalById(id);
  if (!portal) notFound();

  const supabase = createServiceClient();
  const [{ files, status }, { data: emails }] = await Promise.all([
    fetchPortalState(id),
    supabase
      .from("av_event_portal_emails")
      .select("id, kind, recipients, sent_at")
      .eq("portal_id", id)
      .order("sent_at", { ascending: false }),
  ]);

  const signed = files.length
    ? await supabase.storage.from(PORTAL_BUCKET).createSignedUrls(
        files.map((f) => f.storage_path),
        3600,
      )
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/av-portals" className="text-sm text-[var(--muted-foreground)] hover:underline">
          ← AV Event Portals
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{portal.event_name}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {formatEventDate(portal.event_date)}
          {portal.venue_name ? ` · ${portal.venue_name}` : ""} · {showFileNumber(portal)} ·{" "}
          {portal.client_name || portal.client_email}
        </p>
      </div>

      <PortalDetailActions
        id={portal.id}
        link={portalUrl(portal.token)}
        isActive={portal.is_active}
        initial={{
          eventName: portal.event_name,
          clientName: portal.client_name,
          clientEmail: portal.client_email,
          ccEmails: (portal.cc_emails ?? []).join(", "),
          eventDate: portal.event_date,
          venueName: portal.venue_name,
          loadInTime: portal.load_in_time,
          note: portal.note_to_client,
        }}
      />

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-semibold">Cue sheet</h2>
          <span className="text-sm">
            {status.completeCount} of {status.total} received
          </span>
        </div>
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {status.items.map((it) => (
            <li key={it.def.key} className="flex items-start gap-3 p-4 text-sm">
              <span className={it.complete ? "text-emerald-600" : "text-amber-600"}>{it.complete ? "✓" : "○"}</span>
              <div>
                <p className="font-medium">{it.def.label}</p>
                <p className="text-[var(--muted-foreground)]">{it.complete ? it.display : "Not received yet"}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <h2 className="p-4 font-semibold">Files</h2>
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {files.length === 0 && <li className="p-4 text-sm text-[var(--muted-foreground)]">No files yet.</li>}
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <a href={urlByPath.get(f.storage_path) || undefined} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium hover:underline">
                {f.file_name}
              </a>
              <span className="text-xs text-[var(--muted-foreground)]">
                {FILE_KEY_LABEL[f.item_key]} · {(f.size_bytes / 1048576).toFixed(1)} MB
                {f.matched_by === "auto" ? " · auto-sorted" : ""}
              </span>
              <DeleteFileButton portalId={portal.id} fileId={f.id} name={f.file_name} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <h2 className="p-4 font-semibold">Emails sent</h2>
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {(emails ?? []).length === 0 && <li className="p-4 text-sm text-[var(--muted-foreground)]">None yet. Check-ins go out automatically at 30, 14, 7 and 3 days.</li>}
          {(emails ?? []).map((e: { id: string; kind: string; recipients: string[]; sent_at: string }) => (
            <li key={e.id} className="p-4 text-sm">
              <span className="font-medium">
                {e.kind === "complete" ? "All-set thank-you" : e.kind === "manual" ? "Manual check-in" : `${e.kind.slice(1)}-day check-in`}
              </span>{" "}
              <span className="text-[var(--muted-foreground)]">
                to {e.recipients.join(", ")} · {new Date(e.sent_at).toLocaleString("en-US", { timeZone: "America/New_York" })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
