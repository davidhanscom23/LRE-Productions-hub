"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import {
  createQuestionAction,
  deleteQuestionAction,
  submitQuizAction,
} from "@/app/(app)/training-portal/actions";
import type { TrainingQuestion } from "@/lib/types/training";

type Props = {
  lessonId: string;
  courseSlug: string;
  questions: TrainingQuestion[];
  canManage: boolean;
  isAdmin: boolean;
  done: boolean;
  readOnly?: boolean;
};

export function LessonQuiz({
  lessonId,
  courseSlug,
  questions,
  canManage,
  isAdmin,
  done,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    total: number;
    correct: number;
    passed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (Object.keys(answers).length < questions.length) {
      setError("Answer every question before submitting.");
      return;
    }
    startTransition(async () => {
      const res = await submitQuizAction({ lessonId, courseSlug, answers });
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult(res.result ?? null);
      if (res.result?.passed) {
        setRetaking(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {questions.length > 0 && !readOnly ? (
        done && !retaking ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" /> Quiz passed
            </span>
            <button
              type="button"
              onClick={() => {
                setRetaking(true);
                setResult(null);
                setAnswers({});
              }}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Retake
            </button>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Quiz — pass (70%) to complete this lesson
            </p>
            {questions.map((q, qi) => (
              <fieldset key={q.id} className="space-y-1.5">
                <legend className="text-sm font-medium text-[var(--foreground)]">
                  {qi + 1}. {q.prompt}
                </legend>
                <div className="space-y-1">
                  {q.choices.map((choice, ci) => (
                    <label
                      key={ci}
                      className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]"
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === ci}
                        onChange={() =>
                          setAnswers((a) => ({ ...a, [q.id]: ci }))
                        }
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {result && !result.passed ? (
              <p className="text-sm text-red-600">
                Scored {result.correct}/{result.total}. You need 70% to pass —
                review the lesson and try again.
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit quiz
            </button>
          </div>
        )
      ) : null}

      {canManage ? (
        <QuizManager
          lessonId={lessonId}
          courseSlug={courseSlug}
          questions={questions}
          isAdmin={isAdmin}
        />
      ) : null}
    </div>
  );
}

function QuizManager({
  lessonId,
  courseSlug,
  questions,
  isAdmin,
}: {
  lessonId: string;
  courseSlug: string;
  questions: TrainingQuestion[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addQuestion() {
    setError(null);
    startTransition(async () => {
      const res = await createQuestionAction({
        lessonId,
        courseSlug,
        prompt,
        choices,
        correctIndex: correct,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setPrompt("");
      setChoices(["", "", "", ""]);
      setCorrect(0);
      router.refresh();
    });
  }

  function removeQuestion(id: string) {
    startTransition(async () => {
      const res = await deleteQuestionAction(id, courseSlug);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Quiz builder ({questions.length}) — admins &amp; trainers
      </p>

      {questions.length > 0 ? (
        <ul className="space-y-2">
          {questions.map((q, qi) => (
            <li
              key={q.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium text-[var(--foreground)]">
                  {qi + 1}. {q.prompt}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {q.choices.map((c, ci) => (
                    <span key={ci}>
                      {ci > 0 ? " · " : ""}
                      <span
                        className={
                          ci === q.correct_index
                            ? "font-semibold text-emerald-600"
                            : ""
                        }
                      >
                        {c}
                        {ci === q.correct_index ? " ✓" : ""}
                      </span>
                    </span>
                  ))}
                </p>
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  aria-label="Delete question"
                  onClick={() => removeQuestion(q.id)}
                  disabled={pending}
                  className="shrink-0 text-[var(--muted)] hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2 border-t border-[var(--border)] pt-3">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="New question…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        {choices.map((choice, i) => (
          <label key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${lessonId}`}
              checked={correct === i}
              onChange={() => setCorrect(i)}
              title="Mark as correct answer"
            />
            <input
              value={choice}
              onChange={(e) =>
                setChoices((c) =>
                  c.map((v, idx) => (idx === i ? e.target.value : v)),
                )
              }
              placeholder={`Answer ${i + 1}${i < 2 ? " (required)" : " (optional)"}`}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
          </label>
        ))}
        <p className="text-[11px] text-[var(--muted)]">
          Select the radio next to the correct answer.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={addQuestion}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add question
        </button>
      </div>
    </div>
  );
}
