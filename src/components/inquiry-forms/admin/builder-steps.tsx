"use client";

/**
 * Inquiry Forms builder - the steps list (left column of the Build tab).
 * Reorder by drag (handle), keyboard (Space on the handle, arrows, Space) or the up / down
 * buttons. Deleting asks first (the parent shows the confirm dialog).
 */
import { useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, CalendarCheck, GripVertical, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import type { StepDef } from "@/lib/inquiry-forms/types";
import { isAnswerable } from "./builder-catalog";
import { useDropAnimation } from "./builder-spring";
import { IconButton, btn } from "./builder-ui";

export interface BuilderStepsProps {
  steps: StepDef[];
  selectedStepId: string | null;
  errorCountByStep: ReadonlyMap<string, number>;
  onSelect: (stepId: string) => void;
  onMove: (from: number, to: number) => void;
  onRename: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onAddFieldsStep: () => void;
  onAddQualifyStep: () => void;
  canAddQualify: boolean;
}

export function stepSubtitle(step: StepDef): string {
  if (step.kind === "qualify") {
    const checks = step.checks ?? [];
    if (checks.includes("date") && checks.includes("location")) return "Checks date and location";
    if (checks.includes("date")) return "Checks the date";
    if (checks.includes("location")) return "Checks the location";
    return "Checks nothing yet";
  }
  const n = step.fields.filter(isAnswerable).length;
  return n === 1 ? "1 question" : `${n} questions`;
}

function StepFace({
  step,
  index,
  selected,
  errorCount,
}: {
  step: StepDef;
  index: number;
  selected: boolean;
  errorCount: number;
}) {
  const Icon = step.kind === "qualify" ? CalendarCheck : ListChecks;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          selected ? "bg-[var(--brand)] text-white dark:text-gray-950" : "bg-[var(--surface-hover)] text-[var(--foreground)]"
        }`}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--foreground)]">
          {step.title.trim() || "Untitled step"}
        </span>
        <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{stepSubtitle(step)}</span>
        </span>
      </span>
      {errorCount > 0 ? (
        <span
          className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
          aria-label={errorCount === 1 ? "1 problem" : `${errorCount} problems`}
          title={errorCount === 1 ? "1 problem to fix" : `${errorCount} problems to fix`}
        >
          {errorCount}
        </span>
      ) : null}
    </span>
  );
}

const handleClass =
  "flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] active:cursor-grabbing";

function SortableStepRow({
  step,
  index,
  count,
  selected,
  errorCount,
  onSelect,
  onMove,
  onRename,
  onDelete,
}: {
  step: StepDef;
  index: number;
  count: number;
  selected: boolean;
  errorCount: number;
  onSelect: () => void;
  onMove: (to: number) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  const title = step.title.trim() || "Untitled step";
  return (
    <li ref={setNodeRef} style={style} className="list-none" data-step-row={step.id}>
      <div
        className={`rounded-xl border px-2 py-2 transition-colors ${
          selected
            ? "border-[var(--brand)] bg-[var(--brand-soft)]"
            : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
        }`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder step ${index + 1}, ${title}`}
            title="Drag to reorder (or press Space, then the arrow keys)"
            className={handleClass}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onSelect}
            aria-current={selected ? "step" : undefined}
            className="flex min-w-0 flex-1 items-center rounded-lg py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <StepFace step={step} index={index} selected={selected} errorCount={errorCount} />
          </button>
        </div>
        {selected ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-0.5 border-t border-[var(--border)] pt-1.5">
            <IconButton label="Move step up" onClick={() => onMove(index - 1)} disabled={index === 0}>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton label="Move step down" onClick={() => onMove(index + 1)} disabled={index === count - 1}>
              <ArrowDown className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton label="Rename step" onClick={onRename}>
              <Pencil className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton label="Delete step" onClick={onDelete} tone="danger" className="ml-auto">
              <Trash2 className="h-4 w-4" aria-hidden />
            </IconButton>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function BuilderSteps({
  steps,
  selectedStepId,
  errorCountByStep,
  onSelect,
  onMove,
  onRename,
  onDelete,
  onAddFieldsStep,
  onAddQualifyStep,
  canAddQualify,
}: BuilderStepsProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const dropAnimation = useDropAnimation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => steps.map((s) => s.id), [steps]);
  const activeIndex = activeId === null ? -1 : steps.findIndex((s) => s.id === activeId);
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  const titleOf = (id: UniqueIdentifier) => {
    const i = steps.findIndex((s) => s.id === id);
    return i < 0 ? "step" : `step ${i + 1}, ${steps[i].title.trim() || "Untitled step"}`;
  };
  const positionOf = (id: UniqueIdentifier | undefined) => (id === undefined ? -1 : steps.findIndex((s) => s.id === id) + 1);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} is over position ${positionOf(over.id)} of ${steps.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} dropped at position ${positionOf(over.id)} of ${steps.length}.` : `${titleOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Reordering canceled. ${titleOf(active.id)} went back.`,
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = steps.findIndex((s) => s.id === active.id);
    const to = steps.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Steps</h2>
        <span className="text-xs text-[var(--muted)]">{steps.length === 1 ? "1 step" : `${steps.length} steps`}</span>
      </div>
      {steps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--muted)]">
          No steps yet. Add a questions step to start.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "To reorder a step, press Space or Enter on its handle, move it with the arrow keys, then press Space or Enter again to drop it. Press Escape to cancel.",
            },
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1.5" aria-label="Form steps">
              {steps.map((step, index) => (
                <SortableStepRow
                  key={step.id}
                  step={step}
                  index={index}
                  count={steps.length}
                  selected={step.id === selectedStepId}
                  errorCount={errorCountByStep.get(step.id) ?? 0}
                  onSelect={() => onSelect(step.id)}
                  onMove={(to) => onMove(index, to)}
                  onRename={() => onRename(step.id)}
                  onDelete={() => onDelete(step.id)}
                />
              ))}
            </ol>
          </SortableContext>
          <DragOverlay adjustScale={false} dropAnimation={dropAnimation}>
            {activeStep ? (
              <div className="pointer-events-none flex min-w-0 items-center gap-1 rounded-xl border border-[var(--brand)] bg-[var(--surface)] backdrop-blur-md px-2 py-2 shadow-xl">
                <span className="flex h-8 w-6 shrink-0 items-center justify-center text-[var(--muted)]">
                  <GripVertical className="h-4 w-4" aria-hidden />
                </span>
                <StepFace
                  step={activeStep}
                  index={activeIndex}
                  selected={activeStep.id === selectedStepId}
                  errorCount={errorCountByStep.get(activeStep.id) ?? 0}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <div className="flex flex-col gap-1.5">
        <button type="button" className={`${btn.secondary} justify-start`} onClick={onAddFieldsStep}>
          <Plus className="h-4 w-4" aria-hidden /> Questions step
        </button>
        <button
          type="button"
          className={`${btn.secondary} justify-start`}
          onClick={onAddQualifyStep}
          disabled={!canAddQualify}
          title={canAddQualify ? "Adds the date and location check after the selected step" : "This form already has an availability check step"}
        >
          <CalendarCheck className="h-4 w-4" aria-hidden /> Availability check step
        </button>
        {!canAddQualify ? (
          <p className="text-xs text-[var(--muted)]">This form already has an availability check.</p>
        ) : null}
      </div>
    </div>
  );
}
