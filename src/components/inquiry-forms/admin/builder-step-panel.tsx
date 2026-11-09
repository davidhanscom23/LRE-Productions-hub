"use client";

/**
 * Inquiry Forms builder - the right panel when a STEP is selected: title, description,
 * progress label, button text, and for the availability step which checks run.
 */
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarCheck, ListChecks, MapPin, Plus, Trash2 } from "lucide-react";
import type { BusinessSettings, CheckKind, FormDefinition, StepDef } from "@/lib/inquiry-forms/types";
import type { EditorIssue } from "./builder-checks";
import { orderedFields } from "./builder-ops";
import type { FieldTemplateId } from "./builder-catalog";
import { Callout, IconButton, PanelSection, TextField, ToggleField, btn } from "./builder-ui";

export function stepTitleInputId(stepId: string): string {
  return `step-title-${stepId}`;
}

export interface BuilderStepPanelProps {
  definition: FormDefinition;
  step: StepDef;
  stepIndex: number;
  submitLabel: string;
  business: BusinessSettings | null;
  issues: EditorIssue[];
  onUpdate: (patch: Partial<Omit<StepDef, "id" | "fields">>, coalesceKey?: string) => void;
  onBlur: () => void;
  onMove: (to: number) => void;
  onDelete: () => void;
  /** Quick fix: add a field from a template to the first questions step before this one. */
  onAddFieldBefore: (templateId: FieldTemplateId) => void;
}

export function BuilderStepPanel({
  definition,
  step,
  stepIndex,
  submitLabel,
  business,
  issues,
  onUpdate,
  onBlur,
  onMove,
  onDelete,
  onAddFieldBefore,
}: BuilderStepPanelProps) {
  const isLast = stepIndex === definition.steps.length - 1;
  const next = definition.steps[stepIndex + 1];
  const defaultButton = isLast ? submitLabel : next?.title.trim() || "Next";
  const isQualify = step.kind === "qualify";
  const checks = step.checks ?? [];
  const earlier = orderedFields(definition).filter((l) => l.stepIndex < stepIndex);
  const hasDateBefore = earlier.some((l) => l.field.role === "event_date");
  const hasPlaceBefore = earlier.some((l) => l.field.role === "event_location");
  const anyFieldsStepBefore = definition.steps.slice(0, stepIndex).some((s) => s.kind === "fields");

  const setCheck = (kind: CheckKind, on: boolean) => {
    const set = new Set(checks);
    if (on) set.add(kind);
    else set.delete(kind);
    const ordered: CheckKind[] = (["date", "location"] as const).filter((k) => set.has(k));
    onUpdate({ checks: ordered });
  };

  const Icon = isQualify ? CalendarCheck : ListChecks;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-[var(--muted)]">Step {stepIndex + 1}</p>
            <h2 className="truncate text-sm font-semibold text-[var(--foreground)]">
              {isQualify ? "Availability check step" : "Questions step"}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Move step up" onClick={() => onMove(stepIndex - 1)} disabled={stepIndex === 0}>
            <ArrowUp className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Move step down" onClick={() => onMove(stepIndex + 1)} disabled={isLast}>
            <ArrowDown className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Delete step" tone="danger" onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {issues.map((issue) => (
        <Callout key={issue.id} tone={issue.severity === "error" ? "error" : "warning"}>
          {issue.message}
        </Callout>
      ))}

      <PanelSection title="Step details">
        <TextField
          id={stepTitleInputId(step.id)}
          label="Title"
          value={step.title}
          onChange={(title) => onUpdate({ title }, `step:${step.id}:title`)}
          onBlur={onBlur}
          error={step.title.trim() ? null : "Add a title."}
          placeholder={isQualify ? "Checking our calendar" : "Tell us about your event"}
          maxLength={120}
        />
        <TextField
          label="Description (optional)"
          multiline
          rows={2}
          value={step.description ?? ""}
          onChange={(description) => onUpdate({ description: description || undefined }, `step:${step.id}:description`)}
          onBlur={onBlur}
          hint="One or two lines under the title."
          maxLength={500}
        />
        <TextField
          label="Progress bar label (optional)"
          value={step.progressLabel ?? ""}
          onChange={(progressLabel) => onUpdate({ progressLabel: progressLabel || undefined }, `step:${step.id}:progress`)}
          onBlur={onBlur}
          placeholder={step.title.trim() || "Step"}
          hint="A short word for the progress bar, like You, Event or Finish."
          maxLength={24}
        />
        {isLast ? (
          <TextField
            label="Button text"
            value=""
            onChange={() => undefined}
            disabled
            placeholder={submitLabel}
            hint={`The last step's button always uses the send button label from Settings ("${submitLabel}").`}
          />
        ) : (
          <TextField
            label="Button text (optional)"
            value={step.buttonText ?? ""}
            onChange={(buttonText) => onUpdate({ buttonText: buttonText || undefined }, `step:${step.id}:button`)}
            onBlur={onBlur}
            placeholder={defaultButton}
            hint={`Leave empty to use "${defaultButton}".`}
            maxLength={40}
          />
        )}
      </PanelSection>

      {isQualify ? (
        <PanelSection
          title="What this step checks"
          description="Results come from the server, never the browser. Visitors never see booking counts or names."
        >
          <ToggleField
            label="Event date"
            checked={checks.includes("date")}
            onChange={(on) => setCheck("date", on)}
            hint="Compares the date with the Hub calendar and your blackout dates."
          />
          {checks.includes("date") && business?.availability.mode === "off" ? (
            <Callout tone="warning" actions={<SettingsLink />}>
              Date checks are turned off in Inquiry Forms settings, so visitors skip this check.
            </Callout>
          ) : null}
          {checks.includes("date") && !hasDateBefore ? (
            <Callout
              tone="error"
              actions={
                anyFieldsStepBefore ? (
                  <button type="button" className={btn.secondary} onClick={() => onAddFieldBefore("event_date")}>
                    <Plus className="h-4 w-4" aria-hidden /> Add an Event date question
                  </button>
                ) : null
              }
            >
              No earlier step asks for the event date, so there is nothing to check.
            </Callout>
          ) : null}

          <ToggleField
            label="Event location"
            checked={checks.includes("location")}
            onChange={(on) => setCheck("location", on)}
            hint="Measures the distance from your home base and sorts it into your travel zones."
          />
          {checks.includes("location") && business && !business.location.enabled ? (
            <Callout tone="warning" actions={<SettingsLink />}>
              The location check is turned off in Inquiry Forms settings, so visitors skip this check until it is turned on
              there.
            </Callout>
          ) : null}
          {!checks.includes("location") && business && !business.location.enabled ? (
            <p className="flex items-start gap-1.5 text-xs text-[var(--muted)]">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Location checks are off for the business. Turn them on in Inquiry Forms settings first.
            </p>
          ) : null}
          {checks.includes("location") && !hasPlaceBefore ? (
            <Callout
              tone="error"
              actions={
                anyFieldsStepBefore ? (
                  <button type="button" className={btn.secondary} onClick={() => onAddFieldBefore("event_location")}>
                    <Plus className="h-4 w-4" aria-hidden /> Add a Venue or location question
                  </button>
                ) : null
              }
            >
              No earlier step asks where the event is, so there is nothing to measure.
            </Callout>
          ) : null}
          {business === null ? (
            <p className="text-xs text-[var(--muted)]">
              Could not load the business settings, so this panel cannot tell whether checks are turned on there.
            </p>
          ) : null}
        </PanelSection>
      ) : null}
    </div>
  );
}

function SettingsLink() {
  return (
    <Link href="/inquiry-forms/settings" className={btn.secondary} target="_blank" rel="noreferrer">
      Open Inquiry Forms settings
    </Link>
  );
}
