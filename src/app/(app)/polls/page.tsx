import { PollsClient } from "@/components/polls/polls-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { Poll, PollOption } from "@/lib/types/polls";
import { redirect } from "next/navigation";

function normalizePoll(raw: Record<string, unknown>): Poll {
  const options = Array.isArray(raw.options)
    ? (raw.options as Record<string, unknown>[]).map((o) => ({
        id: String(o.id),
        label: String(o.label ?? ""),
        sort_order: Number(o.sort_order) || 0,
        votes: Number(o.votes) || 0,
      }))
    : [];
  return {
    id: String(raw.id),
    question: String(raw.question ?? ""),
    is_closed: Boolean(raw.is_closed),
    closes_at: (raw.closes_at as string) ?? null,
    created_at: String(raw.created_at ?? ""),
    created_by: String(raw.created_by ?? ""),
    my_option_id: (raw.my_option_id as string) ?? null,
    total_votes: Number(raw.total_votes) || 0,
    options: options as PollOption[],
  };
}

export default async function PollsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const canManage = profile.role === "admin" || profile.role === "trainer";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_polls_with_results");

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Polls needs a database update</p>
        <p className="mt-2">
          Run migration <code>062_polls.sql</code> in Supabase, then refresh. (
          {error.message})
        </p>
      </div>
    );
  }

  const polls = ((data ?? []) as Record<string, unknown>[]).map(normalizePoll);

  return (
    <PollsClient
      polls={polls}
      canManage={canManage}
      canCreate
      currentUserId={profile.id}
    />
  );
}
