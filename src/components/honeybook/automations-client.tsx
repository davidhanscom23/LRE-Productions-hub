"use client";

import {
  previewAutomationsAction,
  saveAutomationAction,
} from "@/app/(app)/honeybook/automations/actions";
import { AUTOMATION_META, type AutomationKey } from "@/lib/honeybook/automations";
import type { AutomationDueItem } from "@/lib/honeybook/automations-run";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type AutomationRow = {
  key: AutomationKey;
  enabled: boolean;
  delay_days: number;
  subject: string;
  body: string;
};

const field =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

function Card({ row, emailReady }: { row: AutomationRow; emailReady: boolean }) {
  const router = useRouter();
  const meta = AUTOMATION_META[row.key];
  const [enabled, setEnabled] = useState(row.enabled);
  const [delay, setDelay] = useState(String(row.delay_days));
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.body);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveAutomationAction({ key: row.key, enabled, delayDays: Number(delay), subject, body });
      setMsg(res.error ?? "Saved.");
      if (!res.error) router.refresh();
    });

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{meta.label}</h2>
          <p className="text-xs text-[var(--muted)]">{meta.when}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {enabled ? "On" : "Off"}
        </label>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <label className="text-xs">
          {meta.delayLabel}
          <input className={`${field} mt-1 max-w-[8rem]`} type="number" min={0} max={730} value={delay} onChange={(e) => setDelay(e.target.value)} />
        </label>
        <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
        <textarea className={`${field} min-h-[150px]`} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
        <p className="text-xs text-[var(--muted)]">
          Fill-ins you can use: {"{{first_name}}"}, {"{{project_name}}"}, {"{{event_date}}"}, {"{{sender_name}}"}.
        </p>
        {enabled && !emailReady && (
          <p className="text-xs text-amber-700">Email isn’t set up yet, so nothing will send until RESEND_API_KEY and EMAIL_FROM are added in Vercel.</p>
        )}
        <div className="flex items-center gap-3">
          <button className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm font-medium disabled:opacity-40" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
        </div>
      </div>
    </section>
  );
}

export function AutomationsClient({ rows, emailReady }: { rows: AutomationRow[]; emailReady: boolean }) {
  const [due, setDue] = useState<AutomationDueItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <Card key={r.key} row={r} emailReady={emailReady} />
      ))}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Who would get an email today?</h2>
            <p className="text-xs text-[var(--muted)]">A safe preview of the automations that are On. Nothing is sent.</p>
          </div>
          <button
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await previewAutomationsAction();
                setErr(res.error);
                setDue(res.error ? null : res.due);
              })
            }
          >
            {pending ? "Checking…" : "Preview"}
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        {due && (
          due.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No one is due right now.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
              {due.map((d) => (
                <li key={`${d.key}-${d.projectId}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <a className="hover:underline" href={`/honeybook/projects/${d.projectId}`}>{d.projectName}</a>
                  <span className="text-xs text-[var(--muted)]">{AUTOMATION_META[d.key].label} → {d.to}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  );
}
