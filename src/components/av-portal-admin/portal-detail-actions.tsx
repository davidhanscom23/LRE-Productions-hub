"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, ExternalLink, Mail, Pause, Pencil, Play, Trash2 } from "lucide-react";
import {
  deletePortalAction,
  deletePortalFileAction,
  sendCheckinNowAction,
  setPortalActiveAction,
  updatePortalAction,
  type PortalInput,
} from "@/app/(app)/av-portals/actions";

const inputCls = "w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm";
const btn = "inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50";

export function PortalDetailActions({
  id,
  link,
  isActive,
  initial,
}: {
  id: string;
  link: string;
  isActive: boolean;
  initial: PortalInput;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<PortalInput>(initial);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setMsg({ ok: false, text: res.error ?? "Something went wrong." });
      setMsg({ ok: true, text: okText });
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setMsg({ ok: true, text: "Client link copied." });
            } catch {
              setMsg({ ok: false, text: link });
            }
          }}
        >
          <Copy className="h-4 w-4" /> Copy client link
        </button>
        <a className={btn} href={link} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" /> Open portal
        </a>
        <button
          type="button"
          className={btn}
          disabled={pending || !isActive}
          onClick={() => run(() => sendCheckinNowAction(id), "Check-in email sent.")}
        >
          <Mail className="h-4 w-4" /> Send check-in now
        </button>
        <button type="button" className={btn} onClick={() => setEditing((e) => !e)}>
          <Pencil className="h-4 w-4" /> Edit details
        </button>
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() => run(() => setPortalActiveAction(id, !isActive), isActive ? "Portal paused." : "Portal resumed.")}
        >
          {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {isActive ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          className={`${btn} text-red-600`}
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Delete this portal and all uploaded files? This cannot be undone.")) return;
            run(() => deletePortalAction(id), "Deleted.", () => router.push("/av-portals"));
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

      {editing && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["eventName", "Event name"],
                ["eventDate", "Event date"],
                ["clientName", "Client name"],
                ["clientEmail", "Client email"],
                ["venueName", "Venue"],
                ["loadInTime", "Load-in time"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="text-sm">
                {label}
                <input
                  type={k === "eventDate" ? "date" : "text"}
                  className={inputCls}
                  value={f[k]}
                  onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))}
                />
              </label>
            ))}
            <label className="text-sm sm:col-span-2">
              CC emails
              <input className={inputCls} value={f.ccEmails} onChange={(e) => setF((s) => ({ ...s, ccEmails: e.target.value }))} />
            </label>
            <label className="text-sm sm:col-span-2">
              Note to client
              <textarea rows={2} className={inputCls} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} />
            </label>
          </div>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            onClick={() => run(() => updatePortalAction(id, f), "Saved.", () => setEditing(false))}
          >
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}

export function DeleteFileButton({ portalId, fileId, name }: { portalId: string; fileId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Delete ${name}`}
      className="rounded-lg border border-[var(--border)] p-1.5 text-red-600 disabled:opacity-50"
      onClick={() => {
        if (!window.confirm(`Delete ${name}?`)) return;
        start(async () => {
          await deletePortalFileAction(portalId, fileId);
          router.refresh();
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
