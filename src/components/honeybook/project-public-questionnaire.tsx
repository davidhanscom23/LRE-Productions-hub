"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  CRM_QUESTIONS,
  type CrmQuestionnaireAnswers,
  type CrmQuestionKey,
} from "@/lib/honeybook/questionnaire";
import { saveCrmQuestionnaireAction } from "@/app/project/[token]/actions";

export function ProjectPublicQuestionnaire({
  token,
  answers: initialAnswers,
  submittedAt,
}: {
  token: string;
  answers: CrmQuestionnaireAnswers;
  submittedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<CrmQuestionnaireAnswers>(initialAnswers);
  const [message, setMessage] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  function setField(key: CrmQuestionKey, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setSavedOk(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await saveCrmQuestionnaireAction({ token, answers });
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      setSavedOk(true);
      router.refresh();
    });
  }

  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
        Project questionnaire
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        A few planning details help us prepare. You can save and come back to
        update anytime.
      </p>
      {submittedAt ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Last saved{" "}
          {new Date(submittedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {CRM_QUESTIONS.map((q) => (
          <label key={q.key} className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">
              {q.label}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              {q.hint}
            </span>
            {q.multiline ? (
              <textarea
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                rows={3}
                value={answers[q.key] ?? ""}
                placeholder={q.placeholder}
                disabled={pending}
                onChange={(e) => setField(q.key, e.target.value)}
              />
            ) : (
              <input
                type="text"
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                value={answers[q.key] ?? ""}
                placeholder={q.placeholder}
                disabled={pending}
                onChange={(e) => setField(q.key, e.target.value)}
              />
            )}
          </label>
        ))}

        {message ? (
          <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
        ) : null}
        {savedOk ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Saved — thank you.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save answers"}
        </button>
      </form>
    </section>
  );
}
