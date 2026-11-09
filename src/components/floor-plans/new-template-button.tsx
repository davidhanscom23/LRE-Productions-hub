"use client";

import { createFloorPlan } from "@/app/(app)/floor-plans/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function NewTemplateButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createFloorPlan({ projectId: null });
            if (res.error !== null) setError(res.error);
            else router.push(`/floor-plans/${res.id}`);
          })
        }
      >
        + New template
      </button>
    </div>
  );
}
