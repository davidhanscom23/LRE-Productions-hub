import { redirect } from "next/navigation";
import { MeetingsClient } from "@/components/meetings/meetings-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isAiConfigured } from "@/lib/kb";
import { createClient } from "@/lib/supabase/server";
import type {
  MeetingActionItemRow,
  MeetingNote,
  MeetingNoteListItem,
} from "@/lib/types/meeting-notes";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "trainer") redirect("/");

  const { id: selectedId } = await searchParams;
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("meeting_notes")
    .select("id, title, meeting_date, quality_score, analyzed_at, created_at")
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Meetings needs a database update</p>
        <p className="mt-2">
          Run migration <code>104_meeting_intelligence.sql</code> in Supabase,
          then refresh.
        </p>
      </div>
    );
  }

  const meetings = (rows ?? []) as MeetingNoteListItem[];

  // All action items (for the dashboard + Action Items tab).
  const { data: aiRows } = await supabase
    .from("meeting_action_items")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false });
  const titleById = new Map(meetings.map((m) => [m.id, m.title]));
  const actionItems: MeetingActionItemRow[] = (
    (aiRows ?? []) as MeetingActionItemRow[]
  ).map((a) => ({ ...a, meeting_title: titleById.get(a.meeting_id) ?? null }));

  // Selected meeting detail (defaults to newest).
  const pickId = selectedId || meetings[0]?.id;
  let selected: MeetingNote | null = null;
  if (pickId) {
    const { data: detail } = await supabase
      .from("meeting_notes")
      .select("*")
      .eq("id", pickId)
      .maybeSingle();
    if (detail) selected = detail as MeetingNote;
  }

  return (
    <MeetingsClient
      meetings={meetings}
      actionItems={actionItems}
      selected={selected}
      aiReady={isAiConfigured()}
    />
  );
}
