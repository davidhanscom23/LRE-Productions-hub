import "server-only";

/**
 * Inquiry Forms - sends the one-way LeadLeaf (GoHighLevel) copy and logs each attempt
 * (kind ghl_copy). The caller (runCompletionSideEffects) decides whether the copy is still owed;
 * this file only builds, sends and records. Mappings live in forward-core.ts.
 *
 * INQUIRY_FORMS_GHL_URL points the copy at a local capture server in test rigs. Production leaves
 * it unset.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCrmSummary, formatAnswerLines } from "../answers";
import type { FormDefinition, FormSettings } from "../types";
import { crmEndingFor } from "./crm-claim-core";
import { writeLog, type SubmissionRecord } from "./db";
import {
  BROWSER_USER_AGENT,
  GHL_EVENTS_URL,
  buildGhlPayload,
  readGhlResult,
} from "./forward-core";
import { LOG_KINDS } from "./schema-core";

const SEND_TIMEOUT_MS = 15_000;

export type CopyOutcome = "sent" | "failed" | "skipped";

export interface CopyContext {
  submission: SubmissionRecord;
  form: { id: string; name: string; slug: string };
  definition: FormDefinition;
  settings: FormSettings;
  /** Absolute link to the CRM record (or the submission) in the hub. */
  hubLink: string | null;
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300);
}

function summaryOf(ctx: CopyContext) {
  const sub = ctx.submission;
  return buildCrmSummary(ctx.definition, sub.answers, sub.qualification, crmEndingFor(sub.stage), sub.score_label);
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** POST the inquiry to GoHighLevel as the website's own contact form would. */
export async function sendGhlCopy(sb: SupabaseClient, ctx: CopyContext, now: Date = new Date()): Promise<CopyOutcome> {
  const cfg = ctx.settings.copies.ghl;
  if (!cfg || !cfg.enabled) return "skipped";
  const summary = summaryOf(ctx);
  const payload = buildGhlPayload({
    settings: cfg,
    summary,
    formName: ctx.form.name,
    hubLink: ctx.hubLink,
    lines: formatAnswerLines(ctx.definition, ctx.submission.answers),
    pageUrl: ctx.submission.attribution?.page_url ?? null,
    sessionId: randomUUID(),
    now,
  });
  const url = process.env.INQUIRY_FORMS_GHL_URL || GHL_EVENTS_URL;
  let status: "sent" | "failed" = "failed";
  let detail: Record<string, unknown>;
  try {
    const res = await timedFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        version: "2021-07-28",
        "User-Agent": BROWSER_USER_AGENT,
        ...(cfg.siteUrl ? { Referer: cfg.siteUrl } : {}),
      },
      body: JSON.stringify(payload),
    });
    const text = (await res.text().catch(() => "")).slice(0, 2000);
    const verdict = readGhlResult(res.status, text);
    status = verdict.ok ? "sent" : "failed";
    detail = { status: res.status, result: verdict.reason, formId: cfg.formId };
  } catch (err) {
    detail = { error: errorText(err), formId: cfg.formId };
  }
  await writeLog(sb, {
    submissionId: ctx.submission.id,
    kind: LOG_KINDS.ghlCopy,
    status,
    channel: "ghl",
    recipient: `GoHighLevel ${cfg.formId}`,
    detail,
  });
  return status;
}
