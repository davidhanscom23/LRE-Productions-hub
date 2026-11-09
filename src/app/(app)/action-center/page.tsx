import { ActionCenterClient } from "@/components/action-center/action-center-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionComment,
  ActionItem,
  StaffOption,
} from "@/lib/types/action-items";
import { redirect } from "next/navigation";

export default async function ActionCenterPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("action_items")
    .select("*")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Action Center needs a database update</p>
        <p className="mt-2">
          Run migration <code>054_action_items.sql</code> in Supabase, then
          refresh. ({error.message})
        </p>
      </div>
    );
  }

  const [{ data: staff }, assigneeRes, commentRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("action_item_assignees")
      .select("action_id, user_id, done_at"),
    supabase
      .from("action_item_comments")
      .select("id, action_id, author_id, body, created_at")
      .order("created_at", { ascending: true })
      .limit(2000),
  ]);

  if (assigneeRes.error || commentRes.error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Action Center needs a database update</p>
        <p className="mt-2">
          Run migration <code>131_action_center_multi_assign_comments.sql</code>{" "}
          in Supabase, then refresh. (
          {assigneeRes.error?.message ?? commentRes.error?.message})
        </p>
      </div>
    );
  }

  const staffOptions: StaffOption[] = (staff ?? [])
    .filter((s) => (s.full_name as string)?.trim())
    .map((s) => ({ id: s.id as string, full_name: s.full_name as string }));

  const nameById = new Map(staffOptions.map((s) => [s.id, s.full_name]));

  const assigneesByAction = new Map<
    string,
    { user_id: string; done_at: string | null; name?: string }[]
  >();
  for (const row of assigneeRes.data ?? []) {
    const actionId = row.action_id as string;
    const list = assigneesByAction.get(actionId) ?? [];
    list.push({
      user_id: row.user_id as string,
      done_at: (row.done_at as string | null) ?? null,
      name: nameById.get(row.user_id as string) ?? "Someone",
    });
    assigneesByAction.set(actionId, list);
  }

  const commentsByAction = new Map<string, ActionComment[]>();
  for (const row of commentRes.data ?? []) {
    const actionId = row.action_id as string;
    const list = commentsByAction.get(actionId) ?? [];
    list.push({
      id: row.id as string,
      action_id: actionId,
      author_id: row.author_id as string,
      body: row.body as string,
      created_at: row.created_at as string,
      author_name: nameById.get(row.author_id as string) ?? "Someone",
    });
    commentsByAction.set(actionId, list);
  }

  const items: ActionItem[] = (
    (rows ?? []) as Omit<ActionItem, "assignees" | "comments">[]
  ).map((r) => {
    const assignees = assigneesByAction.get(r.id) ?? [];
    return {
      ...r,
      assignees,
      comments: commentsByAction.get(r.id) ?? [],
      creator_name: nameById.get(r.created_by) ?? "Someone",
      assignee_name:
        assignees.length > 0
          ? assignees.map((a) => a.name ?? "Someone").join(", ")
          : null,
    };
  });

  return (
    <ActionCenterClient
      currentUserId={profile.id}
      isAdmin={profile.role === "admin"}
      items={items}
      staff={staffOptions}
    />
  );
}
