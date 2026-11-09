"use client";

import { useState, useTransition } from "react";
import { downloadPublicEstimatePdfAction } from "@/app/estimate/[token]/actions";

export function EstimatePublicClient({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await downloadPublicEstimatePdfAction(token);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            const bytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
              c.charCodeAt(0),
            );
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = result.fileName;
            a.click();
            URL.revokeObjectURL(url);
          });
        }}
        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Preparing…" : "Download PDF"}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
