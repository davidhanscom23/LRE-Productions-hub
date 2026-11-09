"use client";

import { cancelBookingAction } from "@/app/book/[slug]/actions";
import { useState, useTransition } from "react";

export function CancelClient({ token, when, alreadyCancelled }: { token: string; when: string; alreadyCancelled: boolean }) {
  const [done, setDone] = useState(alreadyCancelled);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="text-sm">This booking is cancelled. You are welcome to book a new time anytime.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">Cancel your meeting on {when}?</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <button
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelBookingAction(token);
              if (res.error) setError(res.error);
              else setDone(true);
            })
          }
        >
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
      </div>
    </div>
  );
}
