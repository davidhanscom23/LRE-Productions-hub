"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addActionCommentAction,
  checkOffMyAssignmentAction,
  createActionAction,
  deleteActionAction,
  deleteActionCommentAction,
  toggleActionDoneAction,
  updateActionAction,
} from "@/app/(app)/action-center/actions";
import {
  ACTION_PRIORITIES,
  priorityLabel,
  type ActionItem,
  type ActionPriority,
  type StaffOption,
} from "@/lib/types/action-items";

type Props = {
  currentUserId: string;
  isAdmin: boolean;
  items: ActionItem[];
  staff: StaffOption[];
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDue(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function priorityChip(p: ActionPriority) {
  const styles =
    p === "high"
      ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
      : p === "low"
        ? "bg-[var(--surface-hover)] text-[var(--muted)]"
        : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {priorityLabel(p)}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

/** Multi-select assignee picker: toggleable name chips. */
function AssigneePicker({
  staff,
  selected,
  onChange,
}: {
  staff: StaffOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {staff.map((s) => {
        const on = selected.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition ${
              on
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--foreground)]"
            }`}
          >
            {s.full_name}
          </button>
        );
      })}
      {staff.length === 0 ? (
        <span className="text-xs text-[var(--muted)]">No staff found.</span>
      ) : null}
    </div>
  );
}

function CommentsSection({
  item,
  currentUserId,
  isAdmin,
  canComment,
}: {
  item: ActionItem;
  currentUserId: string;
  isAdmin: boolean;
  canComment: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function post() {
    setError(null);
    startTransition(async () => {
      const r = await addActionCommentAction({ actionId: item.id, body });
      if (r.error) {
        setError(r.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function removeComment(id: string) {
    startTransition(async () => {
      const r = await deleteActionCommentAction(id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
      {item.comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-sm">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-[var(--foreground)]">
              {c.author_name}
            </span>
            <span className="ml-2 text-[11px] text-[var(--muted)]">
              {fmtWhen(c.created_at)}
            </span>
            <p className="whitespace-pre-wrap text-[var(--muted)]">{c.body}</p>
          </div>
          {c.author_id === currentUserId || isAdmin ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => removeComment(c.id)}
              className="shrink-0 text-[11px] text-[var(--muted)] hover:text-red-600"
            >
              Delete
            </button>
          ) : null}
        </div>
      ))}
      {canComment ? (
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            placeholder="Add a comment…"
            className="min-h-9 w-full flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={post}
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Post
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--muted)]">
          Only the task’s creator, its assignees, or an admin can comment.
        </p>
      )}
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}

function TaskRow({
  item,
  currentUserId,
  isAdmin,
  staff,
}: {
  item: ActionItem;
  currentUserId: string;
  isAdmin: boolean;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [detail, setDetail] = useState(item.detail);
  const [assignees, setAssignees] = useState<string[]>(
    item.assignees.map((a) => a.user_id),
  );
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [priority, setPriority] = useState<ActionPriority>(item.priority);

  const myAssignment = item.assignees.find(
    (a) => a.user_id === currentUserId,
  );
  const isCreator = item.created_by === currentUserId;
  const canModify = isCreator || isAdmin;
  const canComment = Boolean(myAssignment) || isCreator || isAdmin;
  const done = item.status === "done";
  const overdue = !done && item.due_date && item.due_date < todayKey();
  const doneCount = item.assignees.filter((a) => a.done_at).length;

  // The checkbox: assignees tick their own part; the creator/admin (when not
  // an assignee) toggles the whole task.
  const checked = myAssignment ? Boolean(myAssignment.done_at) : done;
  const canToggle = Boolean(myAssignment) || canModify;

  function toggle() {
    startTransition(async () => {
      const r = myAssignment
        ? await checkOffMyAssignmentAction({ id: item.id, done: !checked })
        : await toggleActionDoneAction({ id: item.id, done: !done });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  function save() {
    startTransition(async () => {
      const r = await updateActionAction({
        id: item.id,
        title,
        detail,
        assignees,
        dueDate,
        priority,
      });
      if (r.error) {
        alert(r.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this task?")) return;
    startTransition(async () => {
      const r = await deleteActionAction(item.id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-[var(--brand)]/40 bg-[var(--background)] p-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={2}
          placeholder="Detail (optional)"
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-medium text-[var(--muted)]">
            Assignees (tap to toggle)
          </p>
          <AssigneePicker
            staff={staff}
            selected={assignees}
            onChange={setAssignees}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as ActionPriority)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          >
            {ACTION_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={save}
            className="inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={!canToggle || pending}
          onClick={toggle}
          aria-label={
            myAssignment
              ? checked
                ? "Un-check my part"
                : "Check off my part"
              : done
                ? "Mark not done"
                : "Mark done"
          }
          title={
            myAssignment && item.assignees.length > 1
              ? "Check off your part — the task completes when everyone has checked theirs"
              : undefined
          }
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
            checked
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-[var(--border)] hover:border-[var(--brand)]"
          } ${!canToggle ? "cursor-default opacity-60" : ""}`}
        >
          {checked ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-medium ${
                done
                  ? "text-[var(--muted)] line-through"
                  : "text-[var(--foreground)]"
              }`}
            >
              {item.title}
            </span>
            {!done ? priorityChip(item.priority) : null}
            {!done && item.assignees.length > 1 ? (
              <span className="inline-flex items-center rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                {doneCount}/{item.assignees.length} done
              </span>
            ) : null}
          </div>
          {item.detail ? (
            <p className="mt-0.5 text-sm text-[var(--muted)]">{item.detail}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
            <span>
              {item.assignees.length > 0
                ? `→ ${item.assignees
                    .map((a) => `${a.name}${a.done_at ? " ✓" : ""}`)
                    .join(", ")}`
                : "Unassigned"}
            </span>
            {item.due_date ? (
              <span className={overdue ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                Due {fmtDue(item.due_date)}
                {overdue ? " · overdue" : ""}
              </span>
            ) : null}
            <span>by {item.creator_name}</span>
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              💬 {item.comments.length > 0 ? item.comments.length : "Comment"}
            </button>
          </div>
          {showComments ? (
            <CommentsSection
              item={item}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              canComment={canComment}
            />
          ) : null}
        </div>
        {canModify ? (
          <div className="flex shrink-0 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={remove}
              className="text-[var(--muted)] hover:text-red-600"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Section({
  heading,
  list,
  empty,
  currentUserId,
  isAdmin,
  staff,
}: {
  heading: string;
  list: ActionItem[];
  empty: string;
  currentUserId: string;
  isAdmin: boolean;
  staff: StaffOption[];
}) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        {heading}
        {list.length > 0 ? (
          <span className="ml-2 text-[var(--muted)]">{list.length}</span>
        ) : null}
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((it) => (
            <TaskRow
              key={it.id}
              item={it}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              staff={staff}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ActionCenterClient({
  currentUserId,
  isAdmin,
  items,
  staff,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ActionPriority>("normal");
  const [error, setError] = useState<string | null>(null);

  const { mine, others, done } = useMemo(() => {
    const mine: ActionItem[] = [];
    const others: ActionItem[] = [];
    const done: ActionItem[] = [];
    for (const it of items) {
      if (it.status === "done") done.push(it);
      else if (it.assignees.some((a) => a.user_id === currentUserId))
        mine.push(it);
      else others.push(it);
    }
    return { mine, others, done };
  }, [items, currentUserId]);

  function create() {
    setError(null);
    startTransition(async () => {
      const r = await createActionAction({
        title,
        detail,
        assignees,
        dueDate,
        priority,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      setTitle("");
      setDetail("");
      setAssignees([]);
      setDueDate("");
      setPriority("normal");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Action Center
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Shared to-dos for the team. Assign tasks to one or more people, set
          due dates, and track what’s owed.
        </p>
      </header>

      {/* Create */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          New task
        </h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={2}
          placeholder="Detail (optional)"
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-[var(--muted)]">
            Assign to (tap names — pick one or several)
          </p>
          <AssigneePicker
            staff={staff}
            selected={assignees}
            onChange={setAssignees}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as ActionPriority)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          >
            {ACTION_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={create}
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Add task
        </button>
      </Card>

      <Section
        heading="Assigned to me"
        list={mine}
        empty="Nothing assigned to you right now."
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        staff={staff}
      />
      <Section
        heading="Other open tasks"
        list={others}
        empty="No other open tasks."
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        staff={staff}
      />
      {done.length > 0 ? (
        <Section
          heading="Completed"
          list={done.slice(0, 25)}
          empty=""
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          staff={staff}
        />
      ) : null}
    </div>
  );
}
