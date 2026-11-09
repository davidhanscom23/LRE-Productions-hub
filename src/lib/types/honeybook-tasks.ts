export type HoneyBookTaskStatus = "open" | "done";

export type HoneyBookTask = {
  id: string;
  external_id: string | null;
  title: string;
  due_date: string | null;
  status: HoneyBookTaskStatus;
  assignee_email: string;
  assignee_name: string;
  assignee_profile_id: string | null;
  project_id: string | null;
  client_id: string | null;
  project_name: string;
  notes: string;
  source_event: string;
  hub_done: boolean;
  hub_done_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Open for My Week: HoneyBook still open and not locally marked done. */
export function honeyBookTaskIsOpen(task: HoneyBookTask): boolean {
  return task.status === "open" && !task.hub_done;
}
