import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  findHoneyBookProjectsForPacket,
  type HoneyBookProjectMatch,
} from "@/lib/event-packets/honeybook-link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Open gear checklist — LRE" };

type Props = {
  searchParams: Promise<{
    packet?: string;
    uid?: string;
    date?: string;
    title?: string;
  }>;
};

/**
 * Finds the event (Hub project) behind a calendar card or an Event Packet and sends the person to
 * its gear checklist. Calendar cards and packets don't always carry the project id, so this looks
 * it up: the packet's own link first, then date + client name.
 */
export default async function OpenChecklistPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const supabase = await createClient();

  let eventDate = (sp.date ?? "").trim();
  let clientName = (sp.title ?? "").trim();

  if (sp.packet || sp.uid) {
    const q = supabase
      .from("event_packets")
      .select("id, event_date, client_name, honeybook_project_id");
    const { data: packet } = sp.packet
      ? await q.eq("id", sp.packet).maybeSingle()
      : await q.eq("calendar_uid", sp.uid ?? "").maybeSingle();
    if (packet?.honeybook_project_id) {
      redirect(`/event-checklist/${packet.honeybook_project_id}`);
    }
    if (packet) {
      eventDate = String(packet.event_date ?? eventDate);
      clientName = String(packet.client_name ?? clientName);
    }
  }

  let matches: HoneyBookProjectMatch[] = [];
  if (eventDate) {
    matches = await findHoneyBookProjectsForPacket(supabase, { eventDate, clientName });
  }

  if (matches.length === 1) redirect(`/event-checklist/${matches[0].id}`);

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
        <p className="font-semibold text-[var(--foreground)]">
          {matches.length > 1 ? "Which event is this?" : "We couldn't find this event's checklist"}
        </p>
        {matches.length > 1 ? (
          <ul className="mt-3 space-y-2">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/event-checklist/${m.id}`}
                  className="font-medium text-[var(--brand)] hover:underline"
                >
                  {m.name} ({m.project_date ?? "no date"})
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[var(--muted)]">
            The checklist hangs off the event card on the Events board. Open the event there and
            tap Gear checklist. If you only see this message for an event you are assigned to,
            ask an admin to link the event.
          </p>
        )}
        <p className="mt-4">
          <Link href="/honeybook" className="font-medium underline">
            Go to events
          </Link>
        </p>
      </div>
    </div>
  );
}
