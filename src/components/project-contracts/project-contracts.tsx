"use client";

import {
  createProjectContract,
  deleteDraftProjectContract,
  saveContractAsTemplate,
  saveProjectContract,
  sendProjectContract,
  voidProjectContract,
} from "@/app/(app)/honeybook/contract-actions";
import { leftoverTokens } from "@/lib/project-contracts/text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ContractListItem = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "sent" | "signed" | "declined" | "void";
  signUrl: string;
  signerName: string;
  signedAt: string | null;
  sentAt: string | null;
};
export type ContractTemplateOption = { id: string; name: string };

const btn = "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-40";
const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm";
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-700",
  sent: "bg-blue-500/15 text-blue-700",
  signed: "bg-green-600/15 text-green-700",
  declined: "bg-amber-500/15 text-amber-700",
  void: "bg-red-500/15 text-red-700",
};
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso)) : "";

export function ProjectContracts({
  projectId,
  clientEmail,
  contracts,
  templates,
  canManage,
}: {
  projectId: string;
  clientEmail: string;
  contracts: ContractListItem[];
  templates: ContractTemplateOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const run = (fn: () => Promise<{ error: string | null }>, ok?: string, after?: () => void) =>
    start(async () => {
      setError(null);
      setNotice(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        if (ok) setNotice(ok);
        after?.();
        router.refresh();
      }
    });

  const create = () =>
    start(async () => {
      setError(null);
      const res = await createProjectContract({ projectId, templateId: templateId || null });
      if (res.error !== null) {
        setError(res.error);
        return;
      }
      setNotice("Draft created. Click Edit wording to review it, then send it for signature.");
      router.refresh();
    });

  const openEdit = (c: ContractListItem) => {
    setEditing(c.id);
    setTitle(c.title);
    setBody(c.body);
  };

  const send = (c: ContractListItem) => {
    const to = window.prompt("Email this contract for signature to:", clientEmail);
    if (!to) return;
    run(async () => {
      const res = await sendProjectContract({ id: c.id, to, message: "" });
      return { error: res.error };
    }, `Contract emailed to ${to}.`);
  };

  const copy = async (c: ContractListItem) => {
    try {
      await navigator.clipboard.writeText(c.signUrl);
      setNotice("Signing link copied.");
    } catch {
      setNotice(c.signUrl);
    }
  };

  const pdfHref = (id: string) => `/api/project-contracts/${id}/pdf`;
  const left = editing ? leftoverTokens(`${title}\n${body}`) : [];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Contracts</h2>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${input} w-auto max-w-[16rem]`} value={templateId} onChange={(e) => setTemplateId(e.target.value)} aria-label="Contract template">
              <option value="">Blank contract</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" className={btn} disabled={pending} onClick={create}>New contract</button>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
      {notice ? <p className="mt-2 text-sm text-green-700">{notice}</p> : null}
      {contracts.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">No contracts yet.{canManage ? " Start from a template, edit the wording, and send it for e-signature." : ""}</p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {contracts.map((c) => (
          <li key={c.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{c.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>{c.status}</span>
            </div>
            {c.status === "signed" ? <p className="mt-1 text-xs text-[var(--muted)]">Signed by {c.signerName} on {day(c.signedAt)}</p> : null}
            {c.status === "sent" ? <p className="mt-1 text-xs text-[var(--muted)]">Sent {day(c.sentAt)}, waiting for signature</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <a className={btn} href={pdfHref(c.id)} target="_blank" rel="noreferrer">{c.status === "signed" ? "Signed PDF" : "Preview PDF"}</a>
              {canManage && c.status === "draft" ? (
                <>
                  <button type="button" className={btn} onClick={() => (editing === c.id ? setEditing(null) : openEdit(c))}>{editing === c.id ? "Close editor" : "Edit wording"}</button>
                  <button type="button" className={btn} disabled={pending} onClick={() => send(c)}>Send for signature</button>
                  <button type="button" className={btn} disabled={pending} onClick={() => { if (window.confirm(`Delete draft “${c.title}”?`)) run(() => deleteDraftProjectContract(c.id)); }}>Delete</button>
                </>
              ) : null}
              {canManage && c.status === "sent" ? (
                <>
                  <button type="button" className={btn} disabled={pending} onClick={() => send(c)}>Resend</button>
                  <button type="button" className={btn} onClick={() => copy(c)}>Copy signing link</button>
                </>
              ) : null}
              {canManage && (c.status === "sent" || c.status === "draft") ? (
                <button type="button" className={btn} disabled={pending} onClick={() => { if (window.confirm(`Void “${c.title}”? The signing link stops working.`)) run(() => voidProjectContract(c.id)); }}>Void</button>
              ) : null}
            </div>

            {editing === c.id && c.status === "draft" ? (
              <div className="mt-3 space-y-2 rounded-lg bg-[var(--background)] p-3">
                <label className="block text-xs">Title<input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
                <label className="block text-xs">Wording
                  <textarea className={`${input} font-mono text-xs leading-relaxed`} rows={18} value={body} onChange={(e) => setBody(e.target.value)} />
                  <p className="text-xs text-[var(--muted)]">Layout tips: start a line with ## for a heading, - for a bullet, or write Label | value for a details table row.</p>
                </label>
                {left.length ? <p className="text-xs text-amber-700">Fill in or remove these before sending: {left.join(", ")}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg bg-[var(--accent,#2563eb)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={pending} onClick={() => run(() => saveProjectContract({ id: c.id, title, body }), "Draft saved.", () => setEditing(null))}>Save draft</button>
                  <button
                    type="button"
                    className={btn}
                    disabled={pending}
                    onClick={() => {
                      const name = window.prompt("Template name:", title);
                      if (name) run(() => saveContractAsTemplate({ id: c.id, name }), "Saved as a template.");
                    }}
                  >
                    Save as template
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
