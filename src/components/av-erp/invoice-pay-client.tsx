"use client";

import { useState, useTransition } from "react";
import { startInvoiceCheckoutAction } from "@/app/(app)/rentals/invoices/actions";

type Props = {
  token: string;
  outstanding: number;
  canceled?: boolean;
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function InvoicePayClient({ token, outstanding, canceled }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (outstanding <= 0) {
    return (
      <p className="mt-6 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        This invoice is paid in full. Thank you.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {canceled ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Checkout was canceled. You can try again when ready.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startInvoiceCheckoutAction(token);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            window.location.href = result.checkoutUrl;
          });
        }}
        className="h-11 rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Starting checkout…" : `Pay ${money(outstanding)} now`}
      </button>
    </div>
  );
}
