"use client";

/**
 * Inquiry Forms builder - choices editor for single choice, multiple choice and dropdown.
 * The stored value follows the label (snake_case) until someone types their own value, and
 * never follows it for values that past answers already use.
 */
import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ListPlus, Plus, Trash2 } from "lucide-react";
import type { Choice, FieldDef } from "@/lib/inquiry-forms/types";
import {
  appendChoices,
  choiceValueFromLabel,
  isAutoChoiceValue,
  moveItem,
  nextChoiceLabel,
  relabelChoice,
  sanitizeChoiceValue,
  setOtherChoice,
} from "./builder-ops";
import { Callout, IconButton, TextField, ToggleField, btn, inputClass, inputErrorClass } from "./builder-ui";

export interface BuilderChoicesProps {
  field: FieldDef;
  /** Values past answers use: relabeling never changes them. */
  protectedValues: ReadonlySet<string>;
  onChange: (choices: Choice[], coalesceKey?: string) => void;
  onBlur: () => void;
}

export function choiceLabelInputId(fieldId: string, index: number): string {
  return `choice-label-${fieldId}-${index}`;
}

export function BuilderChoices({ field, protectedValues, onChange, onBlur }: BuilderChoicesProps) {
  const choices = field.choices ?? [];
  const [expanded, setExpanded] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const bulkId = useId();
  const allowOther = field.type === "radio" || field.type === "checkbox";
  const showDescription = field.layout === "cards";

  const valueCounts = new Map<string, number>();
  choices.forEach((c) => valueCounts.set(c.value, (valueCounts.get(c.value) ?? 0) + 1));

  const focusLater = (selector: string) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(selector);
      (el?.closest<HTMLElement>("button") ?? el)?.focus();
    });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= choices.length) return;
    onChange(moveItem(choices, from, to));
    setExpanded((cur) => (cur === from ? to : cur === to ? from : cur));
    focusLater(`[data-choice-move="${field.id}-${to}-${to < from ? "up" : "down"}"]`);
  };

  const remove = (index: number) => {
    onChange(choices.filter((_, i) => i !== index));
    setExpanded((cur) => (cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur));
    const next = Math.min(index, choices.length - 2);
    if (next >= 0) focusLater(`#${CSS.escape(choiceLabelInputId(field.id, next))}`);
  };

  const add = () => {
    const label = nextChoiceLabel(choices);
    const value = choiceValueFromLabel(label, new Set(choices.map((c) => c.value)));
    onChange([...choices, { value, label }]);
    const index = choices.length;
    requestAnimationFrame(() => {
      const el = document.getElementById(choiceLabelInputId(field.id, index)) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  };

  const addBulk = () => {
    const lines = bulkText.split("\n");
    const next = appendChoices(choices, lines);
    if (next.length !== choices.length) onChange(next);
    setBulkText("");
    setBulkOpen(false);
  };

  return (
    <div className="space-y-2">
      {choices.length === 0 ? (
        field.type === "checkbox" ? (
          <Callout tone="info">
            No choices: visitors see one checkbox with the question label (good for consent). Add choices to make it a
            multiple choice list.
          </Callout>
        ) : (
          <Callout tone="error">Add at least one choice. Visitors cannot answer a list with nothing in it.</Callout>
        )
      ) : null}

      <ol className="space-y-1.5" aria-label="Choices">
        {choices.map((choice, index) => {
          const labelId = choiceLabelInputId(field.id, index);
          const isOpen = expanded === index;
          const protectedValue = protectedValues.has(choice.value);
          const auto = !protectedValue && isAutoChoiceValue(choices, index);
          const dup = (valueCounts.get(choice.value) ?? 0) > 1;
          const labelMissing = !choice.label.trim();
          return (
            <li key={index} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
              <div className="flex min-w-0 items-center gap-1">
                <label htmlFor={labelId} className="sr-only">
                  Choice {index + 1} label
                </label>
                <input
                  id={labelId}
                  className={`${inputClass} h-8 py-1 ${labelMissing || dup ? inputErrorClass : ""}`}
                  value={choice.label}
                  maxLength={200}
                  placeholder="Choice label"
                  aria-invalid={labelMissing || dup ? true : undefined}
                  onChange={(e) =>
                    onChange(relabelChoice(choices, index, e.target.value, protectedValue), `choice:${field.id}:${index}:label`)
                  }
                  onBlur={onBlur}
                />
                {choice.isOther ? (
                  <span className="shrink-0 rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)]">
                    Other
                  </span>
                ) : null}
                <IconButton label={`Move ${choice.label || "choice"} up`} onClick={() => move(index, index - 1)} disabled={index === 0}>
                  <span data-choice-move={`${field.id}-${index}-up`} className="contents">
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </span>
                </IconButton>
                <IconButton
                  label={`Move ${choice.label || "choice"} down`}
                  onClick={() => move(index, index + 1)}
                  disabled={index === choices.length - 1}
                >
                  <span data-choice-move={`${field.id}-${index}-down`} className="contents">
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </span>
                </IconButton>
                <IconButton
                  label={isOpen ? "Hide choice details" : "Show choice details"}
                  pressed={isOpen}
                  onClick={() => setExpanded(isOpen ? null : index)}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                </IconButton>
                <IconButton label={`Remove ${choice.label || "choice"}`} tone="danger" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconButton>
              </div>
              {dup ? (
                <p className="mt-1 px-1 text-xs font-medium text-red-700 dark:text-red-300">
                  Two choices are stored as &quot;{choice.value}&quot;. Change one stored value below.
                </p>
              ) : null}
              {isOpen ? (
                <div className="mt-2 space-y-3 border-t border-[var(--border)] px-1 pt-2">
                  <TextField
                    label="Stored value"
                    value={choice.value}
                    onChange={(raw) => {
                      const next = choices.slice();
                      next[index] = { ...choice, value: sanitizeChoiceValue(raw) };
                      onChange(next, `choice:${field.id}:${index}:value`);
                    }}
                    onBlur={onBlur}
                    error={!choice.value ? "Add a stored value." : dup ? "Another choice uses this value." : null}
                    hint={
                      protectedValue
                        ? "Past answers use this value, so relabeling keeps it. Change it only if no saved answer needs it."
                        : auto
                          ? "Follows the label. Type your own to keep it fixed."
                          : "What the answer saves as. Show-if rules use it too."
                    }
                    aside={
                      auto ? (
                        <span className="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--foreground)]">
                          Auto
                        </span>
                      ) : null
                    }
                  />
                  {allowOther ? (
                    <ToggleField
                      label="Other (write-in box)"
                      checked={Boolean(choice.isOther)}
                      onChange={(on) => onChange(setOtherChoice(choices, index, on))}
                      hint="Picking it shows a box for their own answer. Only one choice can be Other."
                    />
                  ) : null}
                  {showDescription ? (
                    <TextField
                      label="Description (optional)"
                      value={choice.description ?? ""}
                      onChange={(text) => {
                        const next = choices.slice();
                        const updated: Choice = { ...choice, description: text };
                        if (!text) delete updated.description;
                        next[index] = updated;
                        onChange(next, `choice:${field.id}:${index}:desc`);
                      }}
                      onBlur={onBlur}
                      hint="One short line under the label on the card."
                      maxLength={300}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} onClick={add}>
          <Plus className="h-4 w-4" aria-hidden /> Add choice
        </button>
        <button
          type="button"
          className={btn.ghost}
          aria-expanded={bulkOpen}
          aria-controls={bulkId}
          onClick={() => setBulkOpen((v) => !v)}
        >
          <ListPlus className="h-4 w-4" aria-hidden /> Paste a list
        </button>
      </div>
      {bulkOpen ? (
        <div id={bulkId} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-2.5" data-history-ignore>
          <label htmlFor={`${bulkId}-text`} className="text-xs font-semibold text-[var(--foreground)]">
            One choice per line
          </label>
          <textarea
            id={`${bulkId}-text`}
            className={`${inputClass} min-h-[6rem]`}
            value={bulkText}
            placeholder={"Wedding\nCorporate event\nBirthday"}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className={btn.primary} onClick={addBulk} disabled={!bulkText.trim()}>
              Add these
            </button>
            <button
              type="button"
              className={btn.ghost}
              onClick={() => {
                setBulkText("");
                setBulkOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
