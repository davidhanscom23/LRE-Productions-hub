"use client";

/**
 * Inquiry Forms public renderer - budget field.
 * - tiers: radio cards, plus "I'd rather not say" when allowSkip;
 * - slider: native range (keyboard + screen reader friendly) with the amount shown as dollars, plus a skip link.
 * Below-minimum answers show the field's belowMessage: as a calm note under policy "label"; under
 * "strict_stop" the same text arrives as the field error (flow.stepErrors) and blocks Next.
 */
import { Info } from "lucide-react";
import type { AnswerValue, BudgetAnswer } from "@/lib/inquiry-forms/types";
import { BUDGET_SKIP_LABEL, budgetOutcome } from "@/lib/inquiry-forms/answers";
import { formatUsd } from "./flow";
import { GroupShell, describedBy, fieldDomId, FieldShell, type FieldInputProps } from "./field-shell";

function asBudget(v: AnswerValue | undefined): BudgetAnswer | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const t = (v as { type?: unknown }).type;
  if (t === "tier" || t === "amount" || t === "skip") return v as BudgetAnswer;
  return null;
}

/** Same words staff see in the CRM lines for a skipped budget. */
const SKIP_LABEL = BUDGET_SKIP_LABEL;

function BelowNote({ message }: { message: string }) {
  return (
    <div className="iqf-note" data-tone="caution" role="status">
      <Info size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function BudgetInput({ field, answers, error, onChange }: FieldInputProps) {
  const cfg = field.budget;
  const value = asBudget(answers[field.key]);
  const below =
    cfg && value && value.type !== "skip" && cfg.policy === "label" && budgetOutcome(field, value).passed === false
      ? cfg.belowMessage?.trim() || ""
      : "";

  if (!cfg || cfg.mode === "tiers") {
    const tiers = cfg?.tiers ?? [];
    const name = `iqf-${field.key}`;
    return (
      <GroupShell field={field} error={error} role="radiogroup">
        <div className="iqf-choices" data-layout="cards">
          {tiers.map((t, i) => {
            const checked = value?.type === "tier" && value.tierId === t.id;
            return (
              <label key={t.id} className="iqf-choice" data-checked={checked ? "true" : "false"} data-invalid={error ? "true" : undefined}>
                <input
                  id={i === 0 ? fieldDomId(field.key) : undefined}
                  type="radio"
                  name={name}
                  className="iqf-mark"
                  checked={checked}
                  onChange={() => onChange(field.key, { type: "tier", tierId: t.id })}
                />
                <span className="iqf-choice-text">
                  <span className="iqf-choice-label">{t.label}</span>
                </span>
              </label>
            );
          })}
          {cfg?.allowSkip ? (
            <label className="iqf-choice" data-checked={value?.type === "skip" ? "true" : "false"}>
              <input
                type="radio"
                name={name}
                className="iqf-mark"
                checked={value?.type === "skip"}
                onChange={() => onChange(field.key, { type: "skip" })}
              />
              <span className="iqf-choice-text">
                <span className="iqf-choice-label">{SKIP_LABEL}</span>
              </span>
            </label>
          ) : null}
        </div>
        {below ? <BelowNote message={below} /> : null}
      </GroupShell>
    );
  }

  const slider = cfg.slider ?? { min: 500, max: 50000, step: 500 };
  const min = Math.min(slider.min, slider.max);
  const max = Math.max(slider.min, slider.max);
  const step = slider.step > 0 ? slider.step : 1;
  const amount = value?.type === "amount" ? value.amount : null;
  const skipped = value?.type === "skip";
  const position = amount ?? Math.round((min + max) / 2 / step) * step;
  const setAmount = (raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(field.key, { type: "amount", amount: n });
  };

  return (
    <FieldShell field={field} error={error}>
      <p className="iqf-budget-value" aria-hidden="true">
        {skipped ? "Not shared" : amount !== null ? formatUsd(amount) : "Move the slider to set your budget"}
      </p>
      <input
        id={fieldDomId(field.key)}
        type="range"
        className="iqf-range"
        min={min}
        max={max}
        step={step}
        value={position}
        aria-valuetext={amount !== null ? formatUsd(amount) : "No budget set"}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field, error)}
        onChange={(e) => setAmount(e.target.value)}
        onClick={(e) => setAmount(e.currentTarget.value)}
      />
      <div className="iqf-range-ends" aria-hidden="true">
        <span>{formatUsd(min)}</span>
        <span>{formatUsd(max)}+</span>
      </div>
      {cfg.allowSkip ? (
        skipped ? (
          <button type="button" className="iqf-linkbtn" onClick={() => onChange(field.key, null)}>
            Set a budget instead
          </button>
        ) : (
          <button type="button" className="iqf-linkbtn" onClick={() => onChange(field.key, { type: "skip" })}>
            {SKIP_LABEL}
          </button>
        )
      ) : null}
      {below ? <BelowNote message={below} /> : null}
    </FieldShell>
  );
}
