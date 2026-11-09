"use client";

/**
 * Inquiry Forms builder - the selected step's fields (center column of the Build tab).
 *
 * 2D sortable grid (rectSortingStrategy + closestCorners) so half-width fields reorder the
 * way they sit on the form. Items translate only (CSS.Translate): with mixed half and full
 * widths a scale transform would stretch cards while they shuffle. The floating clone lives
 * only in DragOverlay and settles with the spring drop.
 */
import { useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarCheck, Copy, GripVertical, Lock, MapPin, Settings, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { BusinessSettings, FieldDef, FormDefinition, StepDef } from "@/lib/inquiry-forms/types";
import type { EditorIssue } from "./builder-checks";
import { BUILDER_COPY } from "@/lib/inquiry-forms/hub-copy";
import { ROLE_LABELS, fieldTypeLabel } from "./builder-catalog";
import { AddFieldMenu } from "./builder-add-field";
import { FieldPreview, ShowIfBadge, showIfSummary } from "./builder-preview";
import { useDropAnimation } from "./builder-spring";
import type { FieldTemplateId } from "./builder-catalog";
import { Callout, IconButton, btn } from "./builder-ui";

export interface BuilderFieldsProps {
  definition: FormDefinition;
  step: StepDef;
  stepIndex: number;
  selectedFieldId: string | null;
  issuesByField: ReadonlyMap<string, EditorIssue[]>;
  stepIssues: EditorIssue[];
  lockedFieldIds: ReadonlySet<string>;
  business: BusinessSettings | null;
  onSelectField: (fieldId: string) => void;
  onSelectStep: () => void;
  onAddField: (templateId: FieldTemplateId) => void;
  onMoveField: (from: number, to: number) => void;
  onDuplicateField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
}

function cardTitle(field: FieldDef): string {
  if (field.type === "content") return field.label.trim() || "Text block";
  return field.label.trim() || "Untitled question";
}

function FieldCardFace({
  definition,
  field,
  errorCount,
  locked,
  handle,
  titleSlot,
}: {
  definition: FormDefinition;
  field: FieldDef;
  errorCount: number;
  locked: boolean;
  handle: React.ReactNode;
  titleSlot?: React.ReactNode;
}) {
  const summary = showIfSummary(definition, field);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-1">
        {handle}
        <div className="min-w-0 flex-1 pt-0.5">
          {titleSlot ?? (
            <span className="block truncate text-sm font-medium text-[var(--foreground)]">
              {cardTitle(field)}
              {field.required && field.type !== "content" ? (
                <span className="text-red-600 dark:text-red-400" aria-hidden>
                  {" "}
                  *
                </span>
              ) : null}
            </span>
          )}
          <span className="block truncate text-xs text-[var(--muted)]">
            {fieldTypeLabel(field)}
            {field.role ? ` · ${ROLE_LABELS[field.role]}` : ""}
            {field.width === "half" ? " · Half width" : ""}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 pt-1">
          {locked ? (
            <span title="Key locked: past submissions store answers under it" className="text-[var(--muted)]">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Key locked</span>
            </span>
          ) : null}
          {errorCount > 0 ? (
            <span
              className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
              title={errorCount === 1 ? "1 problem to fix" : `${errorCount} problems to fix`}
            >
              {errorCount}
              <span className="sr-only">{errorCount === 1 ? " problem" : " problems"}</span>
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-2">
        <FieldPreview field={field} />
      </div>
      {field.help ? <p className="mt-1 line-clamp-1 text-[11px] text-[var(--muted)]">{field.help}</p> : null}
      {summary ? (
        <div className="mt-1.5">
          <ShowIfBadge text={summary} />
        </div>
      ) : null}
    </div>
  );
}

const handleClass =
  "flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] active:cursor-grabbing";

function SortableFieldCard({
  definition,
  field,
  index,
  count,
  selected,
  errorCount,
  locked,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  definition: FormDefinition;
  field: FieldDef;
  index: number;
  count: number;
  selected: boolean;
  errorCount: number;
  locked: boolean;
  onSelect: () => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  const title = cardTitle(field);
  const stop = (fn: () => void) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      data-field-card={field.id}
      className={`min-w-0 scroll-mt-24 ${field.width === "full" ? "@sm:col-span-2" : ""}`}
    >
      <div
        onClick={onSelect}
        className={`h-full cursor-pointer rounded-xl border p-2.5 transition-colors ${
          selected
            ? "border-[var(--brand)] bg-[var(--surface)] ring-2 ring-[var(--brand-soft)]"
            : errorCount > 0
              ? "border-red-300 bg-[var(--surface)] hover:border-red-400 dark:border-red-900"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[color-mix(in_srgb,var(--brand)_45%,var(--border))]"
        }`}
      >
        <FieldCardFace
          definition={definition}
          field={field}
          errorCount={errorCount}
          locked={locked}
          handle={
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Reorder ${title}`}
              title="Drag to reorder (or press Space, then the arrow keys)"
              className={handleClass}
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
          }
          titleSlot={
            <button
              type="button"
              onClick={stop(onSelect)}
              aria-pressed={selected}
              className="block w-full truncate rounded text-left text-sm font-medium text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              {title}
              {field.required && field.type !== "content" ? (
                <>
                  <span className="text-red-600 dark:text-red-400" aria-hidden>
                    {" "}
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </>
              ) : null}
            </button>
          }
        />
        {selected ? (
          <div className="mt-2 flex flex-wrap items-center gap-0.5 border-t border-[var(--border)] pt-1.5">
            <IconButton label="Move earlier" onClick={() => onMove(index - 1)} disabled={index === 0}>
              <ChevronUp className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton label="Move later" onClick={() => onMove(index + 1)} disabled={index === count - 1}>
              <ChevronDown className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton label="Duplicate" onClick={onDuplicate}>
              <Copy className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton label="Delete" onClick={onDelete} tone="danger" className="ml-auto">
              <Trash2 className="h-4 w-4" aria-hidden />
            </IconButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QualifySummary({
  step,
  business,
  stepIssues,
  onSelectStep,
}: {
  step: StepDef;
  business: BusinessSettings | null;
  stepIssues: EditorIssue[];
  onSelectStep: () => void;
}) {
  const checks = step.checks ?? [];
  const rows: Array<{ on: boolean; icon: React.ReactNode; title: string; body: string }> = [
    {
      on: checks.includes("date"),
      icon: <CalendarCheck className="h-4 w-4" aria-hidden />,
      title: "Date check",
      body:
        business?.availability.mode === "off"
          ? "Turned off in Inquiry Forms settings, so it is skipped."
          : "Compares the event date with the Hub calendar and shows the result. Counts and names are never shown.",
    },
    {
      on: checks.includes("location"),
      icon: <MapPin className="h-4 w-4" aria-hidden />,
      title: "Location check",
      body:
        business && !business.location.enabled
          ? "Turned off in Inquiry Forms settings, so it is skipped."
          : "Measures the distance from your home base to the event and sorts it into your travel zones.",
    },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--foreground)]">
          Visitors see a short checking animation here, then the result. The server decides every result, using the answers
          from the earlier steps.
        </p>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.title} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  r.on ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                {r.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--foreground)]">
                  {r.title}: {r.on ? "on" : "off"}
                </span>
                {r.on ? <span className="block text-xs text-[var(--muted)]">{r.body}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className={`${btn.secondary} mt-4`} onClick={onSelectStep}>
          <Settings className="h-4 w-4" aria-hidden /> Edit this step
        </button>
      </div>
      {stepIssues.map((issue) => (
        <Callout key={issue.id} tone={issue.severity === "error" ? "error" : "warning"}>
          {issue.message}
        </Callout>
      ))}
    </div>
  );
}

export function BuilderFields({
  definition,
  step,
  stepIndex,
  selectedFieldId,
  issuesByField,
  stepIssues,
  lockedFieldIds,
  business,
  onSelectField,
  onSelectStep,
  onAddField,
  onMoveField,
  onDuplicateField,
  onDeleteField,
}: BuilderFieldsProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const dropAnimation = useDropAnimation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => step.fields.map((f) => f.id), [step.fields]);
  const activeField = activeId === null ? null : (step.fields.find((f) => f.id === activeId) ?? null);

  const nameOf = (id: UniqueIdentifier) => {
    const f = step.fields.find((x) => x.id === id);
    return f ? cardTitle(f) : "field";
  };
  const positionOf = (id: UniqueIdentifier) => step.fields.findIndex((f) => f.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over position ${positionOf(over.id)} of ${step.fields.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)} of ${step.fields.length}.` : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Reordering canceled. ${nameOf(active.id)} went back.`,
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = step.fields.findIndex((f) => f.id === active.id);
    const to = step.fields.findIndex((f) => f.id === over.id);
    if (from >= 0 && to >= 0) onMoveField(from, to);
  };

  const isQualify = step.kind === "qualify";

  return (
    <div className="@container min-w-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Step {stepIndex + 1} {isQualify ? "· Availability check" : "· Questions"}
          </p>
          <h2 className="truncate text-lg font-semibold text-[var(--foreground)]">{step.title.trim() || "Untitled step"}</h2>
          {step.description ? <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">{step.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={btn.ghost} onClick={onSelectStep} title="Title, description and button for this step">
            <Settings className="h-4 w-4" aria-hidden /> Step settings
          </button>
          {!isQualify ? <AddFieldMenu onAdd={onAddField} /> : null}
        </div>
      </div>

      {isQualify ? (
        <QualifySummary step={step} business={business} stepIssues={stepIssues} onSelectStep={onSelectStep} />
      ) : step.fields.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">No questions in this step yet</p>
          <p className="max-w-sm text-sm text-[var(--muted)]">
            {BUILDER_COPY.firstQuestionHint}
          </p>
          <AddFieldMenu onAdd={onAddField} label="Add the first field" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "To reorder a field, press Space or Enter on its handle, move it with the arrow keys, then press Space or Enter again to drop it. Press Escape to cancel.",
            },
          }}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-2.5 @sm:grid-cols-2" role="list" aria-label={`Fields in step ${stepIndex + 1}`}>
              {step.fields.map((field, index) => (
                <SortableFieldCard
                  key={field.id}
                  definition={definition}
                  field={field}
                  index={index}
                  count={step.fields.length}
                  selected={field.id === selectedFieldId}
                  errorCount={(issuesByField.get(field.id) ?? []).filter((i) => i.severity === "error").length}
                  locked={lockedFieldIds.has(field.id)}
                  onSelect={() => onSelectField(field.id)}
                  onMove={(to) => onMoveField(index, to)}
                  onDuplicate={() => onDuplicateField(field.id)}
                  onDelete={() => onDeleteField(field.id)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay adjustScale={false} dropAnimation={dropAnimation}>
            {activeField ? (
              <div className="pointer-events-none rounded-xl border border-[var(--brand)] bg-[var(--surface)] backdrop-blur-md p-2.5 shadow-2xl">
                <FieldCardFace
                  definition={definition}
                  field={activeField}
                  errorCount={(issuesByField.get(activeField.id) ?? []).filter((i) => i.severity === "error").length}
                  locked={lockedFieldIds.has(activeField.id)}
                  handle={
                    <span className="flex h-7 w-6 shrink-0 items-center justify-center text-[var(--muted)]">
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </span>
                  }
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      {stepIssues.length > 0 && !isQualify ? (
        <div className="mt-3 space-y-2">
          {stepIssues.map((issue) => (
            <Callout key={issue.id} tone={issue.severity === "error" ? "error" : "warning"}>
              {issue.message}
            </Callout>
          ))}
        </div>
      ) : null}
    </div>
  );
}
