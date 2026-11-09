"use client";

/**
 * Inquiry Forms builder - budget question editor: price ranges or a slider, what counts as
 * workable, and what happens below it. Dollar amounts are whole dollars as typed (never
 * cents: "1000" is $1,000).
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { BudgetConfig, BudgetTier } from "@/lib/inquiry-forms/types";
import { newId } from "@/lib/inquiry-forms/definition";
import { BUILDER_COPY } from "@/lib/inquiry-forms/hub-copy";
import { defaultBudgetConfig } from "./builder-catalog";
import { moveItem, newBudgetTier } from "./builder-ops";
import { Callout, IconButton, NumberField, SegmentedField, TextField, ToggleField, btn } from "./builder-ui";

export interface BuilderBudgetProps {
  fieldId: string;
  budget: BudgetConfig | undefined;
  onChange: (budget: BudgetConfig, coalesceKey?: string) => void;
  onBlur: () => void;
}

export function BuilderBudget({ fieldId, budget, onChange, onBlur }: BuilderBudgetProps) {
  if (!budget) {
    return (
      <Callout
        tone="error"
        title="This budget question has no setup"
        actions={
          <button type="button" className={btn.secondary} onClick={() => onChange(defaultBudgetConfig(newId))}>
            Use the starter ranges
          </button>
        }
      >
        Add price ranges or a slider so visitors can answer.
      </Callout>
    );
  }
  const b = budget;
  const tiers = b.tiers ?? [];
  const slider = b.slider ?? { min: 500, max: 10000, step: 250 };
  const set = (patch: Partial<BudgetConfig>, key?: string) => onChange({ ...b, ...patch }, key);
  const setTier = (index: number, patch: Partial<BudgetTier>, key?: string) => {
    const next = tiers.slice();
    next[index] = { ...next[index], ...patch };
    set({ tiers: next }, key);
  };

  return (
    <div className="space-y-4">
      <SegmentedField
        label="Answer style"
        value={b.mode}
        onChange={(mode) => set({ mode, ...(mode === "slider" && !b.slider ? { slider } : {}) })}
        options={[
          { value: "tiers", label: "Price ranges" },
          { value: "slider", label: "Slider" },
        ]}
      />

      {b.mode === "tiers" ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--foreground)]">Price ranges</p>
          {tiers.length < 2 ? (
            <Callout tone="error">Add at least two ranges so visitors have a real choice.</Callout>
          ) : null}
          <ol className="space-y-2" aria-label="Price ranges">
            {tiers.map((tier, index) => (
              <li key={tier.id} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-end gap-1">
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={`Range ${index + 1} label`}
                      value={tier.label}
                      onChange={(label) => setTier(index, { label }, `tier:${fieldId}:${tier.id}:label`)}
                      onBlur={onBlur}
                      error={tier.label.trim() ? null : "Add a label."}
                      placeholder="$1,000 - $2,500"
                      maxLength={100}
                    />
                  </div>
                  <IconButton label="Move range up" onClick={() => set({ tiers: moveItem(tiers, index, index - 1) })} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Move range down"
                    onClick={() => set({ tiers: moveItem(tiers, index, index + 1) })}
                    disabled={index === tiers.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </IconButton>
                  <IconButton label="Remove range" tone="danger" onClick={() => set({ tiers: tiers.filter((t) => t.id !== tier.id) })}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </IconButton>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="From ($)"
                    value={tier.min ?? null}
                    onChange={(min) => setTier(index, { min }, `tier:${fieldId}:${tier.id}:min`)}
                    onBlur={onBlur}
                    placeholder="No floor"
                  />
                  <NumberField
                    label="To ($)"
                    value={tier.max ?? null}
                    onChange={(max) => setTier(index, { max }, `tier:${fieldId}:${tier.id}:max`)}
                    onBlur={onBlur}
                    placeholder="No ceiling"
                    error={
                      tier.min != null && tier.max != null && tier.min > tier.max ? "Must be at least the From amount." : null
                    }
                  />
                </div>
                <ToggleField
                  label="We can work with this"
                  checked={tier.acceptable}
                  onChange={(acceptable) => setTier(index, { acceptable })}
                  hint={tier.acceptable ? "Scores higher." : "Below what you usually do: scores lower."}
                />
              </li>
            ))}
          </ol>
          <button type="button" className={btn.secondary} onClick={() => set({ tiers: [...tiers, newBudgetTier(tiers)] })}>
            <Plus className="h-4 w-4" aria-hidden /> Add range
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Low end ($)"
              value={slider.min}
              onChange={(min) => set({ slider: { ...slider, min: min ?? 0 } }, `slider:${fieldId}:min`)}
              onBlur={onBlur}
            />
            <NumberField
              label="High end ($)"
              value={slider.max}
              onChange={(max) => set({ slider: { ...slider, max: max ?? 0 } }, `slider:${fieldId}:max`)}
              onBlur={onBlur}
              error={slider.min < slider.max ? null : "Must be above the low end."}
            />
            <NumberField
              label="Step ($)"
              value={slider.step}
              onChange={(step) => set({ slider: { ...slider, step: step ?? 0 } }, `slider:${fieldId}:step`)}
              onBlur={onBlur}
              error={slider.step > 0 ? null : "Must be above zero."}
            />
          </div>
          <NumberField
            label="Minimum you can work with ($)"
            value={b.minimum ?? null}
            onChange={(minimum) => set({ minimum }, `slider:${fieldId}:minimum`)}
            onBlur={onBlur}
            placeholder="No minimum"
            hint="Amounts below this count as below what you can do (see the next setting)."
          />
        </div>
      )}

      <SegmentedField
        label="Below what you can do"
        value={b.policy}
        onChange={(policy) => set({ policy })}
        options={[
          { value: "label", label: "Note it and continue" },
          { value: "strict_stop", label: "Stop the form" },
        ]}
        hint={
          b.policy === "strict_stop"
            ? "Visitors who pick a budget you cannot work with see the message below and cannot go on."
            : BUILDER_COPY.budgetBelowHint
        }
      />
      <TextField
        label="Message for budgets below that"
        multiline
        rows={2}
        value={b.belowMessage ?? ""}
        onChange={(belowMessage) => set({ belowMessage }, `budget:${fieldId}:below`)}
        onBlur={onBlur}
        placeholder="Thanks for sharing. We'll suggest the options that fit your budget best."
        maxLength={500}
      />
      <ToggleField
        label="Let visitors skip this question"
        checked={Boolean(b.allowSkip)}
        onChange={(allowSkip) => set({ allowSkip })}
        hint="Visitors may leave it blank. Skipping never stops the form."
      />
    </div>
  );
}
