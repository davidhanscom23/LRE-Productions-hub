import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChecklistClient } from "@/components/event-checklist/checklist-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadChecklistBoard } from "@/lib/event-checklist/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Gear checklist — Vident" };

type Props = { params: Promise<{ projectId: string }> };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export default async function EventChecklistPage({ params }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { projectId } = await params;
  const supabase = await createClient();
  const board = await loadChecklistBoard(supabase, projectId);

  if (board.status === "not_found") notFound();
  if (board.status === "needs_migration") {
    return (
      <Notice title="Gear checklist needs a database update">
        <p>
          Run migration <code>192_event_gear_checklists.sql</code> in Supabase, then refresh.
        </p>
      </Notice>
    );
  }
  if (board.status === "denied") {
    return (
      <Notice title="This checklist is for the assigned team">
        <p>
          Only staff assigned to this event, and admins, can open its gear checklist. Ask an
          admin to assign you on the event card.
        </p>
        <p className="mt-2">
          <Link href="/honeybook" className="font-medium underline">
            Back to events
          </Link>
        </p>
      </Notice>
    );
  }
  if (board.status === "error") {
    return (
      <Notice title="The checklist could not load">
        <p>{board.message}</p>
      </Notice>
    );
  }

  return (
    <ChecklistClient
      project={board.project}
      checklist={board.checklist}
      items={board.items}
      history={board.history}
      estimateRef={board.estimateRef}
      info={board.info}
      venueOptions={board.venueOptions}
      productOptions={board.productOptions}
      loadedAt={board.loadedAt}
    />
  );
}
