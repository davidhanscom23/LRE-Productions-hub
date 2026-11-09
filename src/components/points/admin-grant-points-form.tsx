"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { adminGrantPointsAction } from "@/app/(app)/points/actions";

type AdminGrantPointsFormProps = {
  userId: string;
  userName: string;
};

export function AdminGrantPointsForm({
  userId,
  userName,
}: AdminGrantPointsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [points, setPoints] = useState("25");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await adminGrantPointsAction({
        userId,
        points: Number(points),
        reason,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Points granted.");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        <Gift className="h-3.5 w-3.5 text-[var(--brand)]" />
        Award Hub points
      </p>
      <p className="text-xs text-[var(--muted)]">
        Grant any amount to {userName} (use a negative number to subtract).
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          step={1}
          required
          className="h-9 w-24 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
          aria-label="Points"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (required)"
          required
          className="h-9 min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Award"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      {message ? (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
    </form>
  );
}
