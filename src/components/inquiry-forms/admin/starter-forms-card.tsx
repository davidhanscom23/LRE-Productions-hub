"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { addStarterForms } from "@/app/(app)/inquiry-forms/actions";
import type { StarterFormSummary } from "./list-types";
import { cls, Notice } from "./list-ui";

/**
 * Empty state of the forms list: one click adds the hub's ready-made forms (live, version 1).
 * Nothing is created automatically; the admin chooses.
 */
export function StarterFormsCard({
  starters,
  onAdded,
}: {
  starters: StarterFormSummary[];
  /** Called with the names of the forms that were created. */
  onAdded?: (names: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await addStarterForms();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onAdded?.(res.created);
      } catch {
        setError("Could not reach the Hub. Check your connection and try again.");
      }
    });
  }

  return (
    <section className={`${cls.card} space-y-4`} aria-labelledby="starter-forms-title">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="starter-forms-title" className={cls.sectionTitle}>
            Start with the ready-made forms
          </h2>
          <p className={`${cls.help} mt-1`}>
            These follow the layout that converts best: contact details first, then the availability check, then
            the event details. They go live at their own links right away. Nothing changes on your websites until
            you paste a form&apos;s embed code there.
          </p>
        </div>
      </div>

      {starters.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {starters.map((s) => (
            <li key={s.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-[var(--foreground)]">{s.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {s.brandName} · {s.stepCount} {s.stepCount === 1 ? "step" : "steps"} · /inquire/{s.slug}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Notice tone="info">No starter forms are set up for this hub. Use New form to build one from scratch.</Notice>
      )}

      {error ? <Notice tone="bad" title="The starter forms were not added">{error}</Notice> : null}

      {starters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={cls.btnPrimary} onClick={add} disabled={pending} aria-busy={pending}>
            {pending ? "Adding the starter forms..." : "Add the starter forms"}
          </button>
          <span className="text-sm text-[var(--muted)]" aria-live="polite">
            {pending ? "Creating each form and publishing version 1." : null}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export default StarterFormsCard;
