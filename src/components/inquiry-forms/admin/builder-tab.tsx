"use client";

/**
 * Inquiry Forms builder - the Build tab: steps (left), the selected step's fields (center) and
 * the step or field panel (right). Three columns on wide screens, stacked under ~1024px.
 * Every edit goes through `editDefinition`, so it is undoable.
 */
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { BusinessSettings, FieldDef, FormDefinition, StepDef } from "@/lib/inquiry-forms/types";
import type { EditorIssue } from "./builder-checks";
import { indexIssues } from "./builder-checks";
import { BuilderFieldPanel, fieldLabelInputId, type FieldPanelActions } from "./builder-field-panel";
import { BuilderFields } from "./builder-fields";
import {
  changeFieldType,
  createFieldFromTemplate,
  dependentsOfKey,
  dependentsOfStep,
  duplicateFieldCopy,
  fillEmptyKey,
  insertAfterField,
  insertField,
  insertStep,
  locateField,
  moveFieldInStep,
  moveFieldToStep,
  moveStep,
  newFieldsStep,
  newQualifyStep,
  rekeyField,
  removeField,
  removeStep,
  retitleField,
  setFieldRole,
  stepIndexById,
  updateField,
  updateStep,
} from "./builder-ops";
import type { FieldTemplateId } from "./builder-catalog";
import { BuilderStepPanel, stepTitleInputId } from "./builder-step-panel";
import { BuilderSteps } from "./builder-steps";
import { ConfirmDialog } from "./builder-ui";

export interface BuilderSelection {
  stepId: string | null;
  fieldId: string | null;
}

export interface ToastOptions {
  /** Show an Undo button while this edit is still the latest one. */
  undoable?: boolean;
  tone?: "default" | "error";
}

export interface BuildTabProps {
  definition: FormDefinition;
  submitLabel: string;
  editDefinition: (updater: (def: FormDefinition) => FormDefinition, coalesceKey?: string) => void;
  breakCoalesce: () => void;
  selection: BuilderSelection;
  onSelect: (selection: BuilderSelection) => void;
  issues: EditorIssue[];
  /** Keys in the published version while submissions exist: locked, and never reused. */
  lockedKeys: ReadonlySet<string>;
  publishedKeys: ReadonlySet<string>;
  /** Choice values past answers use, per field id. */
  protectedChoiceValues: (field: FieldDef) => ReadonlySet<string>;
  business: BusinessSettings | null;
  toast: (message: string, opts?: ToastOptions) => void;
}

type PendingDelete =
  | { kind: "step"; stepId: string; title: string; questionCount: number; dependents: FieldDef[] }
  | { kind: "field"; fieldId: string; label: string; dependents: FieldDef[] };

const EMPTY: ReadonlySet<string> = new Set();

function quoted(s: string, fallback: string): string {
  const t = s.trim();
  return t ? `"${t}"` : fallback;
}

export function BuildTab({
  definition,
  submitLabel,
  editDefinition,
  breakCoalesce,
  selection,
  onSelect,
  issues,
  lockedKeys,
  publishedKeys,
  protectedChoiceValues,
  business,
  toast,
}: BuildTabProps) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const steps = definition.steps;
  const stepIndex = selection.stepId ? stepIndexById(definition, selection.stepId) : -1;
  const step: StepDef | null = stepIndex >= 0 ? steps[stepIndex] : null;
  const field: FieldDef | null = step && selection.fieldId ? (step.fields.find((f) => f.id === selection.fieldId) ?? null) : null;
  const { byField, byStep, errorsByStep } = indexIssues(issues);
  const lockedFieldIds = new Set(
    steps.flatMap((s) => s.fields.filter((f) => lockedKeys.has(f.key)).map((f) => f.id)),
  );
  const canAddQualify = !steps.some((s) => s.kind === "qualify");

  /** Brings the panel into view when the layout is stacked and it sits below the screen. */
  const revealPanel = () => {
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight - 80) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const focusById = (id: string, select = false) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (!el) return;
      el.focus({ preventScroll: false });
      if (select) el.select?.();
    });
  };

  // steps

  const addStep = (kind: "fields" | "qualify") => {
    const newStep = kind === "qualify" ? newQualifyStep(definition, Boolean(business?.location.enabled)) : newFieldsStep();
    const at = stepIndex >= 0 ? stepIndex + 1 : steps.length;
    editDefinition((def) => insertStep(def, newStep, at));
    flushSync(() => onSelect({ stepId: newStep.id, fieldId: null }));
    focusById(stepTitleInputId(newStep.id), true);
    revealPanel();
  };

  const moveStepTo = (from: number, to: number) => {
    if (to < 0 || to >= steps.length || from === to) return;
    editDefinition((def) => moveStep(def, from, to));
  };

  const renameStep = (stepId: string) => {
    flushSync(() => onSelect({ stepId, fieldId: null }));
    focusById(stepTitleInputId(stepId), true);
    revealPanel();
  };

  const askDeleteStep = (stepId: string) => {
    const i = stepIndexById(definition, stepId);
    if (i < 0) return;
    const s = steps[i];
    setPendingDelete({
      kind: "step",
      stepId,
      title: s.title,
      questionCount: s.fields.length,
      dependents: dependentsOfStep(definition, stepId),
    });
  };

  const deleteStep = (stepId: string) => {
    const i = stepIndexById(definition, stepId);
    if (i < 0) return;
    const title = steps[i].title;
    const neighbor = steps[i + 1] ?? steps[i - 1] ?? null;
    editDefinition((def) => removeStep(def, stepId));
    onSelect({ stepId: neighbor?.id ?? null, fieldId: null });
    toast(`Deleted step ${quoted(title, String(i + 1))}.`, { undoable: true });
  };

  // fields

  const addField = (templateId: FieldTemplateId, targetStepId?: string) => {
    const stepId = targetStepId ?? step?.id;
    if (!stepId) return;
    const target = steps.find((s) => s.id === stepId);
    if (!target || target.kind !== "fields") return;
    const newField = createFieldFromTemplate(definition, templateId, lockedKeys);
    const afterIndex = field && !targetStepId && target.fields.some((f) => f.id === field.id)
      ? target.fields.findIndex((f) => f.id === field.id) + 1
      : undefined;
    editDefinition((def) => insertField(def, stepId, newField, afterIndex));
    flushSync(() => onSelect({ stepId, fieldId: newField.id }));
    focusById(fieldLabelInputId(newField.id), true);
    revealPanel();
  };

  const moveField = (from: number, to: number) => {
    if (!step || to < 0 || to >= step.fields.length || from === to) return;
    const stepId = step.id;
    editDefinition((def) => moveFieldInStep(def, stepId, from, to));
  };

  const moveToStep = (fieldId: string, stepId: string) => {
    const loc = locateField(definition, fieldId);
    const targetIndex = stepIndexById(definition, stepId);
    if (!loc || targetIndex < 0) return;
    editDefinition((def) => moveFieldToStep(def, fieldId, stepId));
    onSelect({ stepId, fieldId });
    toast(`Moved ${quoted(loc.field.label, "the question")} to step ${targetIndex + 1}.`, { undoable: true });
  };

  const duplicate = (fieldId: string) => {
    const copy = duplicateFieldCopy(definition, fieldId, lockedKeys);
    if (!copy) return;
    editDefinition((def) => insertAfterField(def, fieldId, copy));
    const loc = locateField(definition, fieldId);
    flushSync(() => onSelect({ stepId: loc?.step.id ?? null, fieldId: copy.id }));
    focusById(fieldLabelInputId(copy.id), true);
  };

  const askDeleteField = (fieldId: string) => {
    const loc = locateField(definition, fieldId);
    if (!loc) return;
    const dependents = dependentsOfKey(definition, loc.field.key, fieldId);
    if (dependents.length > 0) {
      setPendingDelete({ kind: "field", fieldId, label: loc.field.label, dependents });
      return;
    }
    deleteField(fieldId);
  };

  const deleteField = (fieldId: string) => {
    const loc = locateField(definition, fieldId);
    if (!loc) return;
    editDefinition((def) => removeField(def, fieldId));
    if (selection.fieldId === fieldId) onSelect({ stepId: loc.step.id, fieldId: null });
    toast(`Deleted ${quoted(loc.field.label, "the question")}.`, { undoable: true });
  };

  // panels

  const fieldActions = (f: FieldDef): FieldPanelActions => {
    const id = f.id;
    const locked = lockedKeys.has(f.key);
    return {
      retitle: (label) => editDefinition((def) => retitleField(def, id, label, { locked, reserved: lockedKeys }), `field:${id}:label`),
      rekey: (key) => editDefinition((def) => rekeyField(def, id, key), `field:${id}:key`),
      fillEmptyKey: () => {
        breakCoalesce();
        editDefinition((def) => fillEmptyKey(def, id, lockedKeys));
      },
      setRole: (role) => editDefinition((def) => setFieldRole(def, id, role)),
      changeType: (type) => editDefinition((def) => changeFieldType(def, id, type)),
      update: (patch, key) => editDefinition((def) => updateField(def, id, patch), key),
      moveToStep: (stepId) => moveToStep(id, stepId),
      duplicate: () => duplicate(id),
      remove: () => askDeleteField(id),
      breakCoalesce,
    };
  };

  const addFieldBefore = (templateId: FieldTemplateId) => {
    if (stepIndex < 0) return;
    for (let i = stepIndex - 1; i >= 0; i--) {
      if (steps[i].kind === "fields") {
        addField(templateId, steps[i].id);
        return;
      }
    }
  };

  return (
    <div className="@container" data-history-scope>
      <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:grid-cols-[13rem_minmax(0,1fr)_21rem]">
        <aside className="min-w-0 @2xl:col-span-2 @4xl:sticky @4xl:top-4 @4xl:col-span-1 @4xl:max-h-[calc(100dvh-2rem)] @4xl:self-start @4xl:overflow-y-auto">
          <BuilderSteps
            steps={steps}
            selectedStepId={step?.id ?? null}
            errorCountByStep={errorsByStep}
            onSelect={(stepId) => onSelect({ stepId, fieldId: null })}
            onMove={moveStepTo}
            onRename={renameStep}
            onDelete={askDeleteStep}
            onAddFieldsStep={() => addStep("fields")}
            onAddQualifyStep={() => addStep("qualify")}
            canAddQualify={canAddQualify}
          />
        </aside>

        <section className="min-w-0" aria-label="Step content">
          {step ? (
            <BuilderFields
              definition={definition}
              step={step}
              stepIndex={stepIndex}
              selectedFieldId={field?.id ?? null}
              issuesByField={byField}
              stepIssues={byStep.get(step.id) ?? []}
              lockedFieldIds={lockedFieldIds}
              business={business}
              onSelectField={(fieldId) => {
                onSelect({ stepId: step.id, fieldId });
                revealPanel();
              }}
              onSelectStep={() => {
                onSelect({ stepId: step.id, fieldId: null });
                revealPanel();
              }}
              onAddField={(templateId) => addField(templateId)}
              onMoveField={moveField}
              onDuplicateField={duplicate}
              onDeleteField={askDeleteField}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">This form has no steps yet</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Add a questions step to start building.</p>
            </div>
          )}
        </section>

        <div
          ref={panelRef}
          className="min-w-0 scroll-mt-4 @2xl:sticky @2xl:top-4 @2xl:max-h-[calc(100dvh-2rem)] @2xl:self-start @2xl:overflow-y-auto @2xl:pr-0.5"
          aria-label={field ? "Field settings" : "Step settings"}
          role="region"
        >
          {step && field ? (
            <BuilderFieldPanel
              key={field.id}
              definition={definition}
              field={field}
              step={step}
              stepIndex={stepIndex}
              issues={byField.get(field.id) ?? []}
              keyLocked={lockedKeys.has(field.key)}
              keyPublished={publishedKeys.has(field.key)}
              reservedKeys={lockedKeys}
              protectedChoiceValues={lockedKeys.has(field.key) ? protectedChoiceValues(field) : EMPTY}
              actions={fieldActions(field)}
            />
          ) : step ? (
            <BuilderStepPanel
              key={step.id}
              definition={definition}
              step={step}
              stepIndex={stepIndex}
              submitLabel={submitLabel}
              business={business}
              issues={byStep.get(step.id) ?? []}
              onUpdate={(patch, key) => editDefinition((def) => updateStep(def, step.id, patch), key)}
              onBlur={breakCoalesce}
              onMove={(to) => moveStepTo(stepIndex, to)}
              onDelete={() => askDeleteStep(step.id)}
              onAddFieldBefore={addFieldBefore}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
              Select a step or a question to edit it here.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === "step"
            ? pendingDelete.title.trim()
              ? `Delete the step "${pendingDelete.title.trim()}"?`
              : "Delete this step?"
            : `Delete ${quoted(pendingDelete?.kind === "field" ? pendingDelete.label : "", "this question")}?`
        }
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const p = pendingDelete;
          setPendingDelete(null);
          if (!p) return;
          if (p.kind === "step") deleteStep(p.stepId);
          else deleteField(p.fieldId);
        }}
      >
        {pendingDelete?.kind === "step" ? (
          <p>
            {pendingDelete.questionCount === 0
              ? "The step has no questions."
              : `Its ${pendingDelete.questionCount === 1 ? "question goes" : `${pendingDelete.questionCount} questions go`} with it.`}
          </p>
        ) : null}
        {pendingDelete && pendingDelete.dependents.length > 0 ? (
          <p>
            {pendingDelete.dependents.length === 1 ? "One question shows" : `${pendingDelete.dependents.length} questions show`} only
            for certain answers here ({pendingDelete.dependents.map((d) => d.label.trim() || d.key).join(", ")}). Their show rule
            will be removed, so they always show.
          </p>
        ) : null}
        <p className="text-[var(--muted)]">You can undo this with Ctrl+Z (Cmd+Z on a Mac).</p>
      </ConfirmDialog>
    </div>
  );
}
