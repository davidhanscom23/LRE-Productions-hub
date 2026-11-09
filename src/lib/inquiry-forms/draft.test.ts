import { describe, expect, it } from "vitest";
import { coerceDefinition, emptyDefinition, validateDefinition } from "./definition";
import {
  DRAFT_MAX_BYTES,
  DRAFT_NO_STEPS,
  DRAFT_UNREADABLE,
  draftTooLargeMessage,
  prepareDraftDefinition,
  savedWithIssuesLabel,
} from "./draft";
import type { FormDefinition } from "./types";

function contactStep(): FormDefinition["steps"][number] {
  return {
    id: "s-1",
    kind: "fields",
    title: "Your details",
    fields: [
      { id: "f-1", key: "name", type: "text", role: "name", label: "Full name", required: true, width: "half" },
      { id: "f-2", key: "email", type: "email", role: "email", label: "Email", required: true, width: "half" },
    ],
  };
}

/** What the builder holds mid-edit: an empty step and a field without a label. */
function halfDone(): FormDefinition {
  const def: FormDefinition = { version: 1, steps: [contactStep(), { id: "s-2", kind: "fields", title: "New step", fields: [] }] };
  def.steps[0].fields.push({ id: "f-3", key: "notes", type: "textarea", label: "", required: false, width: "full" });
  return def;
}

describe("prepareDraftDefinition: what a draft save stores", () => {
  it("stores a valid draft in validateDefinition's normalized form, with no issues", () => {
    const def: FormDefinition = { version: 1, steps: [contactStep()] };
    def.steps[0].title = "  Your   details ";
    const r = prepareDraftDefinition(def);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.definition.steps[0].title).toBe("Your details");
  });

  it("stores a draft that fails validateDefinition as it was, with the problems listed", () => {
    const def = halfDone();
    const r = prepareDraftDefinition(def);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valid).toBe(false);
    expect(r.issues).toEqual((validateDefinition(def) as { errors: string[] }).errors);
    expect(r.issues.join("\n")).toMatch(/has no fields/);
    expect(r.issues.join("\n")).toMatch(/needs a label/);
    // Nothing the admin built is dropped: the empty step and the unlabeled field are both kept.
    expect(r.definition.steps).toHaveLength(2);
    expect(r.definition.steps[1].title).toBe("New step");
    expect(r.definition.steps[0].fields.map((f) => f.key)).toEqual(["name", "email", "notes"]);
    // ...in exactly the shape the editor loads it back in (no "unsaved changes" after a reload).
    expect(coerceDefinition(r.definition)).toEqual(r.definition);
  });

  it("accepts the definition as JSON text too", () => {
    const r = prepareDraftDefinition(JSON.stringify(halfDone()));
    expect(r.ok && r.definition.steps.length).toBe(2);
  });

  it("refuses only what cannot be stored: not an object, no list of steps, unreadable", () => {
    expect(prepareDraftDefinition(null)).toEqual({ ok: false, error: DRAFT_UNREADABLE });
    expect(prepareDraftDefinition(undefined)).toEqual({ ok: false, error: DRAFT_UNREADABLE });
    expect(prepareDraftDefinition([contactStep()])).toEqual({ ok: false, error: DRAFT_UNREADABLE });
    expect(prepareDraftDefinition("{not json")).toEqual({ ok: false, error: DRAFT_UNREADABLE });
    expect(prepareDraftDefinition({ version: 1 })).toEqual({ ok: false, error: DRAFT_NO_STEPS });
    expect(prepareDraftDefinition({ steps: "one" })).toEqual({ ok: false, error: DRAFT_NO_STEPS });
    const circular: Record<string, unknown> = { steps: [] };
    circular.self = circular;
    expect(prepareDraftDefinition(circular)).toEqual({ ok: false, error: DRAFT_UNREADABLE });
    expect(prepareDraftDefinition({ steps: [], big: BigInt(1) })).toEqual({ ok: false, error: DRAFT_UNREADABLE });
    // An empty list of steps is a draft (a problem to fix, not a reason to lose the save).
    const empty = prepareDraftDefinition({ steps: [] });
    expect(empty.ok && empty.issues).toEqual(["The form needs at least one step."]);
  });

  it("caps a draft at 512 KB of JSON, counted in UTF-8 bytes", () => {
    expect(DRAFT_MAX_BYTES).toBe(512 * 1024);
    const def = halfDone();
    const base = JSON.stringify({ ...def, padding: "" }).length;
    const fits = { ...def, padding: "a".repeat(DRAFT_MAX_BYTES - base) };
    expect(JSON.stringify(fits).length).toBe(DRAFT_MAX_BYTES);
    expect(prepareDraftDefinition(fits).ok).toBe(true);
    const over = { ...def, padding: "a".repeat(DRAFT_MAX_BYTES - base + 1) };
    expect(prepareDraftDefinition(over)).toEqual({ ok: false, error: draftTooLargeMessage(DRAFT_MAX_BYTES + 1) });
    // "é" is 2 bytes: half as many characters already reach the cap.
    const wide = { ...def, padding: "é".repeat(Math.ceil((DRAFT_MAX_BYTES - base) / 2) + 1) };
    expect(prepareDraftDefinition(wide).ok).toBe(false);
    expect(draftTooLargeMessage(DRAFT_MAX_BYTES + 1)).toBe(
      "This draft is too large to save (513 KB, the limit is 512 KB). Remove some questions, options or long text, then save again.",
    );
  });

  it("drops only entries that hold no work (not an object, a field without a type)", () => {
    const r = prepareDraftDefinition({
      steps: ["junk", { title: "Kept", progressLabel: 5, fields: [{ key: "a", label: "A" }, { type: "text", key: "b", label: "B" }] }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.definition.steps).toHaveLength(1);
    expect(r.definition.steps[0].title).toBe("Kept");
    expect(r.definition.steps[0].fields.map((f) => f.key)).toEqual(["b"]);
    // Readers use step text as text: a non-string label is dropped, never stored.
    expect(r.definition.steps[0]).not.toHaveProperty("progressLabel");
  });

  it("stores a brand-new form unchanged", () => {
    const def = emptyDefinition();
    const r = prepareDraftDefinition(def);
    expect(r.ok && r.valid).toBe(true);
  });
});

describe("savedWithIssuesLabel", () => {
  it("counts issues in plain words", () => {
    expect(savedWithIssuesLabel(1)).toBe("Saved with 1 issue");
    expect(savedWithIssuesLabel(3)).toBe("Saved with 3 issues");
  });
});
