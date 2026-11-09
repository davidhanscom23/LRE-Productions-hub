"use client";

/**
 * Inquiry Forms builder - "show this question only when..." editor.
 * Sources are limited to EARLIER answerable questions; operators fit the source type and
 * values come from the source's own choices.
 */
import { useId } from "react";
import { isConsentCheckbox } from "@/lib/inquiry-forms/definition";
import type { FieldDef, FormDefinition, ShowIf } from "@/lib/inquiry-forms/types";
import {
  defaultShowIf,
  earlierAnswerableFields,
  locateField,
  locateFieldByKey,
  opNeedsValues,
  showIfChoicesFor,
  showIfOpsFor,
} from "./builder-ops";
import { opPhrase } from "./builder-preview";
import { Callout, SelectField, ToggleField } from "./builder-ui";

export interface BuilderShowIfProps {
  definition: FormDefinition;
  field: FieldDef;
  onChange: (showIf: ShowIf | null) => void;
}

/** Operators visibility.ts evaluates the same way. */
const SAME_AS: Partial<Record<ShowIf["op"], ShowIf["op"]>> = {
  equals: "includes",
  includes: "equals",
  not_equals: "not_includes",
  not_includes: "not_equals",
};

const OP_LABELS: Record<ShowIf["op"], string> = {
  equals: "is one of",
  not_equals: "is not one of",
  includes: "includes one of",
  not_includes: "includes none of",
  answered: "has any answer",
};

/** The nearest earlier question with answers to pick from, else the nearest one. */
function pickDefaultSource(candidates: FieldDef[]): FieldDef | null {
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (showIfChoicesFor(candidates[i]).length > 0) return candidates[i];
  }
  return candidates[candidates.length - 1] ?? null;
}

export function BuilderShowIf({ definition, field, onChange }: BuilderShowIfProps) {
  const groupId = useId();
  const candidates = earlierAnswerableFields(definition, field.id);
  const rule = field.showIf ?? null;
  const sourceLoc = rule ? locateFieldByKey(definition, rule.fieldKey) : null;
  const source = sourceLoc?.field ?? null;
  const sourceIsEarlier = Boolean(source && candidates.some((c) => c.id === source.id));
  const stepOf = (f: FieldDef) => (locateField(definition, f.id)?.stepIndex ?? 0) + 1;

  if (!rule && candidates.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]">
        Add a question before this one to show it only for certain answers.
      </p>
    );
  }

  const turnOn = () => {
    const src = pickDefaultSource(candidates);
    if (src) onChange(defaultShowIf(src));
  };

  if (!rule) {
    return (
      <ToggleField
        label="Show only for certain answers"
        checked={false}
        onChange={(on) => (on ? turnOn() : undefined)}
        hint="Hide this question until an earlier answer matches."
      />
    );
  }

  const ops = source ? showIfOpsFor(source) : [];
  const choices = source ? showIfChoicesFor(source) : [];
  const values = rule.values ?? [];
  // visibility.ts treats equals/includes (and their negatives) alike, so a rule kept across a
  // type switch (single to multiple choice) still reads as the matching option here.
  const shownOp: ShowIf["op"] | null = ops.includes(rule.op)
    ? rule.op
    : (ops.find((op) => SAME_AS[rule.op] === op) ?? null);

  return (
    <div className="space-y-3">
      <ToggleField
        label="Show only for certain answers"
        checked
        onChange={(on) => (on ? undefined : onChange(null))}
        hint="Hidden answers are dropped when the form is sent."
      />
      {!source ? (
        <Callout tone="error">The question this rule used is gone. Pick another one below, or turn the rule off.</Callout>
      ) : !sourceIsEarlier ? (
        <Callout tone="error">
          &quot;{source.label}&quot; now comes after this question, so visitors would not have answered it yet. Pick an earlier
          question or move this one later.
        </Callout>
      ) : null}

      <SelectField
        label="When this question"
        value={sourceIsEarlier && source ? source.id : ""}
        onChange={(id) => {
          const next = candidates.find((c) => c.id === id);
          if (next) onChange(defaultShowIf(next));
        }}
        options={[
          ...(sourceIsEarlier ? [] : [{ value: "", label: "Pick an earlier question", disabled: true }]),
          ...candidates.map((c) => ({ value: c.id, label: `Step ${stepOf(c)}: ${c.label.trim() || c.key}` })),
        ]}
      />

      {source && sourceIsEarlier ? (
        <>
          <SelectField
            label="Rule"
            value={shownOp ?? ""}
            onChange={(op) => {
              const nextOp = op as ShowIf["op"];
              if (!opNeedsValues(nextOp)) {
                onChange({ fieldKey: source.key, op: nextOp });
              } else {
                const known = new Set(choices.map((c) => c.value));
                onChange({ fieldKey: source.key, op: nextOp, values: values.filter((v) => known.has(v)) });
              }
            }}
            options={[
              ...(shownOp ? [] : [{ value: "", label: "Pick a rule", disabled: true }]),
              ...ops.map((op) => ({
                value: op,
                label: op === "answered" && isConsentCheckbox(source) ? "is checked" : OP_LABELS[op],
              })),
            ]}
            hint={ops.length === 1 ? "This kind of question can only be checked for having an answer." : undefined}
          />
          {shownOp && opNeedsValues(shownOp) ? (
            <fieldset className="min-w-0">
              <legend id={groupId} className="mb-1 text-xs font-semibold text-[var(--foreground)]">
                Answers
              </legend>
              {choices.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">That question has no choices yet.</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                  {choices.map((c) => {
                    const checked = values.includes(c.value);
                    const inputId = `${groupId}-${c.value}`;
                    return (
                      <div key={c.value} className="flex items-center gap-2">
                        <input
                          id={inputId}
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...values, c.value] : values.filter((v) => v !== c.value);
                            onChange({ fieldKey: source.key, op: shownOp, values: next });
                          }}
                        />
                        <label htmlFor={inputId} className="min-w-0 flex-1 truncate text-sm text-[var(--foreground)]">
                          {c.label || c.value}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
              {values.length === 0 && choices.length > 0 ? (
                <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">Pick at least one answer.</p>
              ) : (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Shown when &quot;{source.label.trim() || source.key}&quot; {opPhrase(shownOp, values.length > 1)}{" "}
                  {values.map((v) => choices.find((c) => c.value === v)?.label ?? v).join(", ")}.
                </p>
              )}
            </fieldset>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
