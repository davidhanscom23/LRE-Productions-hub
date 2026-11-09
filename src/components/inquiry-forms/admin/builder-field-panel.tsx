"use client";

/**
 * Inquiry Forms builder - the right panel when a FIELD is selected.
 *
 * The key follows the label until someone types their own key, and is locked once the key is
 * in the published version AND submissions exist (past answers are stored under it).
 */
import { Copy, Lock, Trash2 } from "lucide-react";
import type { BudgetConfig, Choice, FieldDef, FieldRole, FieldType, FormDefinition, ShowIf, StepDef } from "@/lib/inquiry-forms/types";
import { BUILDER_COPY } from "@/lib/inquiry-forms/hub-copy";
import type { EditorIssue } from "./builder-checks";
import {
  ROLE_HELP,
  ROLE_LABELS,
  TYPE_LABELS,
  fieldTypeLabel,
  isAnswerable,
  rolesForType,
  typeFamily,
  usesChoices,
  usesPlaceholder,
} from "./builder-catalog";
import { BuilderBudget } from "./builder-budget";
import { BuilderChoices } from "./builder-choices";
import { availableRoles, isAutoKey, keyProblem, sanitizeKeyInput, type FieldPatch } from "./builder-ops";
import { BuilderShowIf } from "./builder-show-if";
import {
  Callout,
  IconButton,
  NumberField,
  PanelSection,
  SegmentedField,
  SelectField,
  TextField,
  ToggleField,
} from "./builder-ui";

export function fieldLabelInputId(fieldId: string): string {
  return `field-label-${fieldId}`;
}

export interface FieldPanelActions {
  retitle: (label: string) => void;
  rekey: (key: string) => void;
  /** On leaving the key box: an empty key is made from the label again. */
  fillEmptyKey: () => void;
  setRole: (role: FieldRole | null) => void;
  changeType: (type: FieldType) => void;
  update: (patch: FieldPatch, coalesceKey?: string) => void;
  moveToStep: (stepId: string) => void;
  duplicate: () => void;
  remove: () => void;
  breakCoalesce: () => void;
}

export interface BuilderFieldPanelProps {
  definition: FormDefinition;
  field: FieldDef;
  step: StepDef;
  stepIndex: number;
  issues: EditorIssue[];
  /** Key is in the published version and submissions exist. */
  keyLocked: boolean;
  /** Key is in the published version (no submissions yet). */
  keyPublished: boolean;
  /** Retired keys that still hold answers: new keys avoid them. */
  reservedKeys: ReadonlySet<string>;
  /** Choice values past answers use (relabeling keeps them). */
  protectedChoiceValues: ReadonlySet<string>;
  actions: FieldPanelActions;
}

export function BuilderFieldPanel({
  definition,
  field,
  step,
  stepIndex,
  issues,
  keyLocked,
  keyPublished,
  reservedKeys,
  protectedChoiceValues,
  actions,
}: BuilderFieldPanelProps) {
  const answerable = isAnswerable(field);
  const family = typeFamily(field.type);
  const possibleRoles = rolesForType(field.type);
  const freeRoles = availableRoles(definition, field);
  const auto = !keyLocked && isAutoKey(definition, field, reservedKeys);
  const keyError = keyProblem(definition, field.id, field.key);
  const otherSteps = definition.steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.kind === "fields" && s.id !== step.id);
  const onBlur = actions.breakCoalesce;
  const coalesce = (what: string) => `field:${field.id}:${what}`;
  const shapeChange = (t: FieldType) =>
    (field.type === "checkbox") !== (t === "checkbox");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)]">
            Step {stepIndex + 1} · {fieldTypeLabel(field)}
          </p>
          <h2 className="truncate text-sm font-semibold text-[var(--foreground)]">
            {field.label.trim() || (answerable ? "Untitled question" : "Text block")}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Duplicate field" onClick={actions.duplicate}>
            <Copy className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Delete field" tone="danger" onClick={actions.remove}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {issues.map((issue) => (
        <Callout key={issue.id} tone={issue.severity === "error" ? "error" : "warning"}>
          {issue.message}
        </Callout>
      ))}

      <PanelSection title={answerable ? "Question" : "Text block"}>
        <TextField
          id={fieldLabelInputId(field.id)}
          label={answerable ? "Label" : "Name (staff only)"}
          value={field.label}
          onChange={actions.retitle}
          onBlur={onBlur}
          error={answerable && !field.label.trim() ? "Add a label." : null}
          hint={answerable ? "What visitors read above the answer." : "Helps you find this block in the builder."}
          maxLength={200}
        />
        {field.type === "content" ? (
          <>
            <TextField
              label="Text visitors see"
              multiline
              rows={4}
              value={field.content?.text ?? ""}
              onChange={(text) => actions.update({ content: { ...(field.content ?? {}), text } }, coalesce("content"))}
              onBlur={onBlur}
              error={(field.content?.text ?? "").trim() ? null : "Write the text for this block."}
              maxLength={5000}
            />
            <SegmentedField
              label="Style"
              value={field.content?.tone ?? "info"}
              onChange={(tone) => actions.update({ content: { text: field.content?.text ?? "", tone } })}
              options={[
                { value: "info", label: "Highlighted note" },
                { value: "muted", label: "Plain text" },
              ]}
            />
          </>
        ) : null}

        <TextField
          label="Key"
          value={field.key}
          onChange={(raw) => actions.rekey(sanitizeKeyInput(raw))}
          onBlur={actions.fillEmptyKey}
          disabled={keyLocked}
          spellCheck={false}
          error={keyLocked ? null : keyError}
          aside={
            keyLocked ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)]">
                <Lock className="h-3 w-3" aria-hidden /> Locked
              </span>
            ) : auto ? (
              <span
                className="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--foreground)]"
                title="Follows the label until you type your own key"
              >
                Auto
              </span>
            ) : null
          }
          hint={
            keyLocked
              ? "Locked because submissions already store answers under this key. Changing it would cut those answers off from this question. You can still change the label."
              : keyPublished
                ? "This key is in the live version. Changing it is safe until someone submits."
                : auto
                  ? "Where the answer is stored. It follows the label until you type your own."
                  : "Where the answer is stored. Lowercase letters, numbers and underscores."
          }
        />

        {family && family.length > 1 ? (
          <SegmentedField
            label="Question type"
            value={field.type}
            onChange={(t) => actions.changeType(t)}
            options={family.map((t) => ({
              value: t,
              label: TYPE_LABELS[t],
              disabled: keyLocked && shapeChange(t),
            }))}
            hint={
              keyLocked && family.includes("checkbox")
                ? "Switching to or from multiple choice is locked: past answers use the current shape."
                : undefined
            }
          />
        ) : null}

        {possibleRoles.length > 0 ? (
          <SelectField
            label="Role"
            value={field.role ?? ""}
            onChange={(v) => actions.setRole(v ? (v as FieldRole) : null)}
            options={[
              { value: "", label: "None" },
              ...possibleRoles.map((r) => ({
                value: r,
                label: freeRoles.includes(r) ? ROLE_LABELS[r] : `${ROLE_LABELS[r]} (used by another question)`,
                disabled: !freeRoles.includes(r),
              })),
            ]}
            hint={field.role ? ROLE_HELP[field.role] : BUILDER_COPY.roleHelpFallback}
          />
        ) : null}
      </PanelSection>

      {answerable ? (
        <PanelSection title="Answer">
          <ToggleField
            label="Required"
            checked={field.required}
            onChange={(required) => actions.update({ required })}
            hint={field.showIf ? "Only required while the question is shown." : undefined}
          />
          <SegmentedField
            label="Width"
            value={field.width}
            onChange={(width) => actions.update({ width })}
            options={[
              { value: "full", label: "Full" },
              { value: "half", label: "Half" },
            ]}
            hint="Two half-width questions sit side by side on wider screens and stack on phones."
          />
          {usesPlaceholder(field.type) ? (
            <TextField
              label={field.type === "select" ? "Empty option text (optional)" : "Placeholder (optional)"}
              value={field.placeholder ?? ""}
              onChange={(placeholder) => actions.update({ placeholder: placeholder || undefined }, coalesce("placeholder"))}
              onBlur={onBlur}
              hint={field.type === "select" ? "Shown before a choice is picked." : "Example text inside the empty box."}
              maxLength={200}
            />
          ) : null}
          <TextField
            label="Help text (optional)"
            multiline
            rows={2}
            value={field.help ?? ""}
            onChange={(help) => actions.update({ help: help || undefined }, coalesce("help"))}
            onBlur={onBlur}
            hint="A short line under the question."
            maxLength={500}
          />
        </PanelSection>
      ) : (
        <PanelSection title="Layout">
          <SegmentedField
            label="Width"
            value={field.width}
            onChange={(width) => actions.update({ width })}
            options={[
              { value: "full", label: "Full" },
              { value: "half", label: "Half" },
            ]}
          />
        </PanelSection>
      )}

      {usesChoices(field.type) ? (
        <PanelSection
          title="Choices"
          description={
            field.type === "checkbox" ? "Visitors can pick any number." : field.type === "select" ? "Shown as a dropdown." : "Visitors pick one."
          }
        >
          {field.type !== "select" ? (
            <SegmentedField
              label="Look"
              value={field.layout ?? "list"}
              onChange={(layout) => actions.update({ layout })}
              options={[
                { value: "list", label: "List" },
                { value: "cards", label: "Cards" },
                { value: "chips", label: "Chips" },
              ]}
            />
          ) : null}
          <BuilderChoices
            field={field}
            protectedValues={protectedChoiceValues}
            onChange={(choices: Choice[], key?: string) => actions.update({ choices }, key)}
            onBlur={onBlur}
          />
        </PanelSection>
      ) : null}

      {field.type === "number" ? (
        <PanelSection title="Number range">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Smallest"
              value={field.min ?? null}
              allowDecimal
              onChange={(min) => actions.update({ min }, coalesce("min"))}
              onBlur={onBlur}
              placeholder="Any"
            />
            <NumberField
              label="Largest"
              value={field.max ?? null}
              allowDecimal
              onChange={(max) => actions.update({ max }, coalesce("max"))}
              onBlur={onBlur}
              placeholder="Any"
              error={field.min != null && field.max != null && field.min > field.max ? "Must be at least the smallest." : null}
            />
          </div>
        </PanelSection>
      ) : null}

      {field.type === "text" || field.type === "textarea" || field.type === "address" ? (
        <PanelSection title="Length" description="Up to 2,000 characters.">

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="At least (characters)"
              value={field.minLength ?? null}
              onChange={(minLength) => actions.update({ minLength }, coalesce("minLength"))}
              onBlur={onBlur}
              placeholder="No minimum"
            />
            <NumberField
              label="At most (characters)"
              value={field.maxLength ?? null}
              onChange={(maxLength) => actions.update({ maxLength }, coalesce("maxLength"))}
              onBlur={onBlur}
              placeholder="No maximum"
              error={
                field.minLength != null && field.maxLength != null && field.minLength > field.maxLength
                  ? "Must be at least the minimum."
                  : null
              }
            />
          </div>
        </PanelSection>
      ) : null}

      {field.type === "time" ? (
        <PanelSection title="Time">
          <ToggleField
            label="Also ask for an end time"
            checked={Boolean(field.showEndTime)}
            onChange={(showEndTime) => actions.update({ showEndTime })}
            hint="Adds a second time box saved with the start time."
          />
        </PanelSection>
      ) : null}

      {field.type === "budget" ? (
        <PanelSection title="Budget">
          <BuilderBudget
            fieldId={field.id}
            budget={field.budget}
            onChange={(budget: BudgetConfig, key?: string) => actions.update({ budget }, key)}
            onBlur={onBlur}
          />
        </PanelSection>
      ) : null}

      <PanelSection title="Show only for certain answers">
        <BuilderShowIf
          definition={definition}
          field={field}
          onChange={(showIf: ShowIf | null) => actions.update({ showIf })}
        />
      </PanelSection>

      {otherSteps.length > 0 ? (
        <PanelSection title="Move">
          <SelectField
            label="Move to another step"
            value=""
            onChange={(stepId) => {
              if (stepId) actions.moveToStep(stepId);
            }}
            options={[
              { value: "", label: "Pick a step..." },
              ...otherSteps.map(({ s, i }) => ({ value: s.id, label: `Step ${i + 1}: ${s.title.trim() || "Untitled step"}` })),
            ]}
            hint="The question goes to the end of that step."
          />
        </PanelSection>
      ) : null}
    </div>
  );
}
