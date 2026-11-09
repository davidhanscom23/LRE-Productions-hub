"use client";

import { startProjectInvoiceCheckout } from "@/app/pay/[token]/actions";
import { useState, useTransition } from "react";

export function PayClient({ token, label, amount }: { token: string; label: string; amount: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pay = () =>
    start(async () => {
      setError(null);
      const res = await startProjectInvoiceCheckout(token);
      if (res.error || !res.url) setError(res.error ?? "Could not start checkout.");
      else window.location.href = res.url;
    });
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="w-full rounded-xl bg-[var(--accent,#2563eb)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Opening secure checkout…" : `Pay ${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} — ${label}`}
      </button>
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
