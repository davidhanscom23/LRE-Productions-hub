/**
 * Inquiry Forms - what a draft save may store. PURE module (the admin editor runs the same gate
 * before it calls saveDraft, the server action runs it again).
 *
 * A draft save never loses work: any draft that can be read (an object with a list of steps, at
 * most DRAFT_MAX_BYTES of JSON) is stored, and the problems that keep it from being published come
 * back next to it. Publishing and the public form still require a definition that passes
 * validateDefinition.
 */
import { coerceDefinition, validateDefinition } from "./definition";
import type { FormDefinition } from "./types";

/** Largest draft definition a save stores: 512 KB of JSON (UTF-8 bytes). */
export const DRAFT_MAX_BYTES = 512 * 1024;

export const DRAFT_UNREADABLE = "This draft could not be read, so it was not saved. Reload the page and try again.";
export const DRAFT_NO_STEPS = "This draft has no list of steps, so it was not saved. Reload the page and try again.";

export function draftTooLargeMessage(bytes: number): string {
  const kb = Math.ceil(bytes / 1024);
  return `This draft is too large to save (${kb} KB, the limit is ${DRAFT_MAX_BYTES / 1024} KB). Remove some questions, options or long text, then save again.`;
}

export type DraftDefinitionResult =
  | {
      ok: true;
      /** What to store: validateDefinition's normalized copy, or (with problems) coerceDefinition's. */
      definition: FormDefinition;
      /** true when the definition can be published as it is. */
      valid: boolean;
      /** validateDefinition's messages (empty when valid). */
      issues: string[];
      /** UTF-8 size of the JSON that came in. */
      bytes: number;
    }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * The definition a draft save stores, or why it cannot be stored at all. Accepts the definition
 * object or its JSON text. Never throws.
 */
export function prepareDraftDefinition(raw: unknown): DraftDefinitionResult {
  let json: string | undefined;
  try {
    json = typeof raw === "string" ? raw : JSON.stringify(raw);
  } catch {
    // Circular structures and BigInt values cannot be stored as JSON.
    json = undefined;
  }
  if (typeof json !== "string") return { ok: false, error: DRAFT_UNREADABLE };
  const bytes = utf8Bytes(json);
  if (bytes > DRAFT_MAX_BYTES) return { ok: false, error: draftTooLargeMessage(bytes) };

  let parsed: unknown;
  try {
    // A JSON round trip also drops what a database row cannot hold (undefined, functions).
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: DRAFT_UNREADABLE };
  }
  if (!isRecord(parsed)) return { ok: false, error: DRAFT_UNREADABLE };
  if (!Array.isArray(parsed.steps)) return { ok: false, error: DRAFT_NO_STEPS };

  const checked = validateDefinition(parsed);
  if (checked.ok) return { ok: true, definition: checked.def, valid: true, issues: [], bytes };
  return { ok: true, definition: coerceDefinition(parsed), valid: false, issues: checked.errors, bytes };
}

/** "Saved with 1 issue" / "Saved with 3 issues" (the editor's save state). */
export function savedWithIssuesLabel(count: number): string {
  return `Saved with ${count} ${count === 1 ? "issue" : "issues"}`;
}
