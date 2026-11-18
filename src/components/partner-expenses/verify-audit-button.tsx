"use client";

import { useState, useTransition } from "react";
import { verifyAuditLogAction } from "@/app/(app)/partner-expenses/actions";

export function VerifyAuditButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await verifyAuditLogAction();
            if (res.error !== null) {
              setMessage({ ok: false, text: res.error });
              return;
            }
            setMessage(
              res.ok
                ? {
                    ok: true,
                    text: `Log verified. All ${res.rowsChecked} entries are intact and in order.`,
                  }
                : {
                    ok: false,
                    text: `Warning: the log was altered at entry #${res.firstBadId}. Do not rely on it, and contact David.`,
                  },
            );
          })
        }
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60"
      >
        {pending ? "Checking…" : "Verify the log is untouched"}
      </button>
      {message ? (
        <p
          role="status"
          className={`mt-2 text-sm font-medium ${message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
