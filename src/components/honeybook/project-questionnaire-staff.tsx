"use client";

import {
  CRM_QUESTIONS,
  hasAnyCrmAnswer,
  type CrmQuestionnaireAnswers,
} from "@/lib/honeybook/questionnaire";

export function ProjectQuestionnaireStaff({
  answers,
  submittedAt,
}: {
  answers: CrmQuestionnaireAnswers | null | undefined;
  submittedAt?: string | null;
}) {
  if (!answers || !hasAnyCrmAnswer(answers)) return null;

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-xs font-medium text-[var(--muted)]">
        Client questionnaire
        {submittedAt
          ? ` · ${new Date(submittedAt).toLocaleDateString()}`
          : ""}
      </p>
      <dl className="mt-2 space-y-2 text-sm">
        {CRM_QUESTIONS.map((q) => {
          const val = answers[q.key]?.trim();
          if (!val) return null;
          return (
            <div key={q.key}>
              <dt className="text-xs text-[var(--muted)]">{q.label}</dt>
              <dd className="whitespace-pre-wrap text-[var(--foreground)]">
                {val}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
