"use client";

import { sendProjectEmailAction } from "@/app/(app)/pipeline/email-actions";
import {
  PROJECT_EMAIL_TEMPLATES,
  applyMergeFields,
  type EmailMergeContext,
} from "@/lib/pipeline/project-email";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const field =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

export function ProjectEmailComposer({
  projectId,
  clientEmail,
  ctx,
  canSend,
}: {
  projectId: string;
  clientEmail: string;
  ctx: EmailMergeContext;
  canSend: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(clientEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pick = (id: string) => {
    setTemplateId(id);
    const t = PROJECT_EMAIL_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setSubject(applyMergeFields(t.subject, ctx));
    setBody(applyMergeFields(t.body, ctx));
  };

  const send = () =>
    start(async () => {
      setMsg(null);
      const res = await sendProjectEmailAction({ projectId, to, subject, body });
      if (res.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: `Sent to ${res.sentTo?.join(", ")}. It's logged in Notes and trail.` });
        setSubject("");
        setBody("");
        setTemplateId("");
        router.refresh();
      }
    });

  if (!canSend) return null;
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Email client</h2>
        <button
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Write an email"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
      )}
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <select className={field} value={templateId} onChange={(e) => pick(e.target.value)} aria-label="Template">
            <option value="">Start from a template…</option>
            {PROJECT_EMAIL_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <input className={field} placeholder="To (comma separated)" value={to} onChange={(e) => setTo(e.target.value)} />
          <input className={field} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className={`${field} min-h-[180px]`} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-[var(--muted)]">
            Replies come straight to you. Fill-ins like the client&apos;s first name are added when you pick a template. Review it before sending.
          </p>
          <div>
            <button
              className="rounded-lg bg-[var(--accent,#2563eb)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              onClick={send}
              disabled={pending || !to.trim() || !subject.trim() || !body.trim()}
            >
              {pending ? "Sending…" : "Send email"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
