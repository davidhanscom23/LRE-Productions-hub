/**
 * Inquiry Forms public renderer - same-tab resume via sessionStorage.
 *
 * A reload in the same tab returns the visitor to the step they were on with their answers, their
 * submission capability ({id, token}) and the availability results already shown. sessionStorage dies
 * with the tab, and the record is ignored when the form was republished (versionId changed) or is old.
 * Storage can be unavailable (privacy modes, blocked third-party storage in an iframe): every access is
 * wrapped, and the form simply runs without resume.
 */
import type { Answers } from "@/lib/inquiry-forms/types";
import type { Ending, QualifyResult } from "./flow";

export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface QualifyCacheEntry {
  key: string;
  result: QualifyResult;
}

export interface StoredSession {
  v: 1;
  formId: string;
  versionId: string | null;
  submission: { id: string; token: string } | null;
  stepIndex: number;
  answers: Answers;
  waitlist: boolean;
  qualify: Record<string, QualifyCacheEntry>;
  ending: Ending | null;
  savedAt: number;
  /** When the visitor first opened the form in this tab (fill time survives a reload). */
  openedAt?: number;
}

export function sessionKey(slug: string): string {
  return `inquiry-forms:v1:${slug}`;
}

export function viewKey(slug: string): string {
  return `inquiry-forms:v1:view:${slug}`;
}

/** sessionStorage when it is usable, else null. */
export function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const probe = "inquiry-forms:probe";
    window.sessionStorage.setItem(probe, "1");
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEnding(v: unknown): Ending | null {
  if (!isRecord(v)) return null;
  if (v.kind !== "completed" && v.kind !== "waitlisted") return null;
  if (typeof v.title !== "string" || typeof v.message !== "string") return null;
  const redirectUrl = typeof v.redirectUrl === "string" ? v.redirectUrl : null;
  return { kind: v.kind, title: v.title, message: v.message, redirectUrl };
}

function parseQualifyCache(v: unknown): Record<string, QualifyCacheEntry> {
  const out: Record<string, QualifyCacheEntry> = {};
  if (!isRecord(v)) return out;
  for (const [stepId, entry] of Object.entries(v)) {
    if (!isRecord(entry) || typeof entry.key !== "string" || !isRecord(entry.result)) continue;
    const r = entry.result;
    if (!isRecord(r.qualification) || typeof r.celebrate !== "boolean") continue;
    out[stepId] = {
      key: entry.key,
      result: {
        qualification: r.qualification as QualifyResult["qualification"],
        celebrate: r.celebrate,
        urgency: typeof r.urgency === "string" ? r.urgency : null,
      },
    };
  }
  return out;
}

/** Read and validate the stored session for this exact form version; null when absent or unusable. */
export function readSession(
  storage: Storage | null,
  slug: string,
  expect: { formId: string; versionId: string | null; stepCount: number },
  now: number,
): StoredSession | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(sessionKey(slug));
  } catch {
    return null;
  }
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.v !== 1) return null;
  if (data.formId !== expect.formId || (data.versionId ?? null) !== expect.versionId) return null;
  if (typeof data.savedAt !== "number" || now - data.savedAt > SESSION_MAX_AGE_MS || data.savedAt > now + 60_000) {
    return null;
  }
  const stepIndex = data.stepIndex;
  if (typeof stepIndex !== "number" || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= expect.stepCount) {
    return null;
  }
  if (!isRecord(data.answers)) return null;
  let submission: StoredSession["submission"] = null;
  if (isRecord(data.submission)) {
    const { id, token } = data.submission;
    if (typeof id === "string" && id && typeof token === "string" && token) submission = { id, token };
  }
  // Without a submission the visitor can only be on the first step.
  const safeStep = submission ? stepIndex : 0;
  return {
    v: 1,
    formId: expect.formId,
    versionId: expect.versionId,
    submission,
    stepIndex: safeStep,
    answers: data.answers as Answers,
    waitlist: data.waitlist === true,
    qualify: parseQualifyCache(data.qualify),
    ending: parseEnding(data.ending),
    savedAt: data.savedAt,
    ...(typeof data.openedAt === "number" && Number.isFinite(data.openedAt) && data.openedAt <= now && data.openedAt <= data.savedAt
      ? { openedAt: data.openedAt }
      : {}),
  };
}

export function writeSession(storage: Storage | null, slug: string, session: StoredSession): void {
  if (!storage) return;
  try {
    storage.setItem(sessionKey(slug), JSON.stringify(session));
  } catch {
    // quota or privacy mode: resume is a convenience, the form keeps working
  }
}

export function clearSession(storage: Storage | null, slug: string): void {
  if (!storage) return;
  try {
    storage.removeItem(sessionKey(slug));
  } catch {
    // ignore
  }
}
