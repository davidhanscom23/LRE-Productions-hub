"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentAction } from "@/app/(app)/honeybook/payment-match-actions";
import {
  formatHoneyBookMoney,
  type HoneyBookClient,
  type HoneyBookPayment,
  type HoneyBookProject,
} from "@/lib/types/honeybook";

const cell = "px-4 py-3";
const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]";

function easternDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** One Payments table row. Admins can edit every column in place. */
export function PaymentRow({
  pay,
  isAdmin,
  clients,
  projects,
}: {
  pay: HoneyBookPayment;
  isAdmin: boolean;
  clients: HoneyBookClient[];
  projects: HoneyBookProject[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(Number(pay.amount) || 0));
  const [paidOn, setPaidOn] = useState(easternDay(pay.paid_at));
  const [clientId, setClientId] = useState(pay.client_id ?? "");
  const [projectId, setProjectId] = useState(pay.project_id ?? "");
  const [note, setNote] = useState(pay.note ?? "");

  const clientOptions = useMemo(
    () => [...clients].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [clients],
  );
  const projectOptions = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updatePaymentAction({
        paymentId: pay.id,
        amount,
        paidOn,
        clientId: clientId || null,
        projectId: projectId || null,
        note,
      });
      if (res.error) setError(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-[var(--border)] bg-[var(--background)] last:border-0">
        <td className={cell}>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={input} aria-label="Paid date" />
        </td>
        <td className={cell}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={input} aria-label="Amount" />
        </td>
        <td className={cell}>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={input} aria-label="Client">
            <option value="">No client</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
            ))}
          </select>
        </td>
        <td className={cell}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={input} aria-label="Project">
            <option value="">No project</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </td>
        <td className={cell}>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={input} aria-label="Note" />
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </td>
        <td className={`${cell} whitespace-nowrap`}>
          <button type="button" disabled={pending} onClick={save} className="mr-2 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
            Save
          </button>
          <button type="button" disabled={pending} onClick={() => setEditing(false)} className="text-xs text-[var(--muted)] underline">
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className={`${cell} text-[var(--muted)]`}>
        {pay.paid_at ? new Date(pay.paid_at).toLocaleDateString() : "—"}
      </td>
      <td className={`${cell} font-medium text-[var(--foreground)]`}>
        {Number(pay.amount) !== 0 ? (
          formatHoneyBookMoney(pay.amount, pay.currency)
        ) : (
          <span
            className="font-normal text-[var(--muted)]"
            title="No amount on this payment. Click Edit to enter it."
          >
            Amount not sent
          </span>
        )}
      </td>
      <td className={`${cell} text-[var(--muted)]`}>{pay.client_name || "—"}</td>
      <td className={`${cell} text-[var(--muted)]`}>{pay.project_name || "—"}</td>
      <td className={`${cell} text-[var(--muted)]`}>{pay.note || "—"}</td>
      {isAdmin ? (
        <td className={cell}>
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-[var(--foreground)] underline">
            Edit
          </button>
        </td>
      ) : null}
    </tr>
  );
}
