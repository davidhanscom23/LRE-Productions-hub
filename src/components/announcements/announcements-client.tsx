"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acknowledgeAnnouncementAction,
  deleteAnnouncementAction,
  postAnnouncementAction,
} from "@/app/(app)/announcements/actions";
import type { Announcement } from "@/lib/types/announcements";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

export function AnnouncementsClient({
  announcements,
  canManage,
  isAdmin,
}: {
  announcements: Announcement[];
  canManage: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [requiresAck, setRequiresAck] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  function post() {
    setError(null);
    startTransition(async () => {
      const r = await postAnnouncementAction({ title, body, requiresAck, expiresAt });
      if (r.error) { setError(r.error); return; }
      setTitle(""); setBody(""); setRequiresAck(false); setExpiresAt("");
      router.refresh();
    });
  }
  function acknowledge(id: string) {
    startTransition(async () => {
      const r = await acknowledgeAnnouncementAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    startTransition(async () => {
      const r = await deleteAnnouncementAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Announcements
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Company updates and notices. Important ones can require acknowledgement.
        </p>
      </header>

      {canManage ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Post an announcement</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write your announcement…"
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} className="h-4 w-4" />
              Require acknowledgement
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              Expires
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" />
            </label>
          </div>
          {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
          <button type="button" disabled={pending || !title.trim()} onClick={post} className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            Post announcement
          </button>
        </Card>
      ) : null}

      {announcements.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No announcements yet.</p>
        </Card>
      ) : (
        announcements.map((a) => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">{a.title}</h3>
                <p className="text-xs text-[var(--muted)]">
                  {a.author_name ? `${a.author_name} · ` : ""}{fmtDate(a.created_at)}
                  {a.expires_at ? ` · expires ${fmtDate(a.expires_at)}` : ""}
                </p>
              </div>
              {a.requires_ack ? (
                <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]">
                  Acknowledgement required
                </span>
              ) : null}
            </div>
            {a.body ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--foreground)]/90">{a.body}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {a.requires_ack ? (
                a.acked ? (
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">✓ Acknowledged</span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => acknowledge(a.id)} className="inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    Acknowledge
                  </button>
                )
              ) : null}
              {isAdmin && a.requires_ack ? (
                <span className="text-xs text-[var(--muted)]">{a.ack_count ?? 0} acknowledged</span>
              ) : null}
              {canManage ? (
                <button type="button" onClick={() => remove(a.id)} className="text-xs text-[var(--muted)] hover:text-red-600">Delete</button>
              ) : null}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
