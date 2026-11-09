export type ActionPriority = "low" | "normal" | "high";
export type ActionStatus = "open" | "done";

export type ActionAssignee = {
  user_id: string;
  /** When this person checked off their part (null = not yet). */
  done_at: string | null;
  /** Joined display name. */
  name?: string;
};

export type ActionComment = {
  id: string;
  action_id: string;
  author_id: string;
  body: string;
  created_at: string;
  /** Joined display name. */
  author_name?: string;
};

export type ActionItem = {
  id: string;
  title: string;
  detail: string;
  created_by: string;
  /** Legacy single assignee (kept in sync with the first of `assignees`). */
  assigned_to: string | null;
  due_date: string | null;
  priority: ActionPriority;
  status: ActionStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** All assignees with their per-person check-off state. */
  assignees: ActionAssignee[];
  comments: ActionComment[];
  /** Joined display names. */
  creator_name?: string;
  assignee_name?: string | null;
};

export const ACTION_PRIORITIES: { value: ActionPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

export type StaffOption = { id: string; full_name: string };

export function priorityLabel(p: ActionPriority): string {
  return ACTION_PRIORITIES.find((x) => x.value === p)?.label ?? "Normal";
}
