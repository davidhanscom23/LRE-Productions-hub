import "server-only";

/**
 * Inquiry Forms - staff alerts and the lead confirmation. Every attempt writes one inquiry_log
 * row (sent / failed / skipped). The caller decides WHEN (completion, sweep); these functions
 * only deliver and record. Spam never reaches this file.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormDefinition } from "../types";
import type { HubAdapter } from "./adapter";
import { writeLog, type SubmissionRecord } from "./db";
import { confirmationEmailFor, headlineFor, staffEmailFor, type InquiryContext } from "./emails";
import { ownerFor, staffRecipients } from "./forward-core";
import { newInquiryNotice, normalizeEmail, submissionHref, unfinishedNotice } from "./lifecycle-core";
import { LOG_KINDS, TABLES } from "./schema-core";
import { countHit } from "./spam";
import { easternDayWindowStart, MAX_CONFIRMATIONS_PER_IP_PER_DAY, overLimit, RATE_KEYS } from "./spam-core";

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/** Where a staff alert for this submission should open. */
export function staffHref(adapter: HubAdapter, submission: Pick<SubmissionRecord, "id" | "form_id" | "crm_ref">): string {
  return adapter.staffRecordHref(submission.crm_ref ?? {}) ?? submissionHref(submission.form_id, submission.id);
}

/**
 * In-app alert (kind web_inquiry) plus the optional staff emails. Returns heard = at least one
 * channel delivered, or no channel is configured (nothing left to retry).
 */
export async function notifyStaffOfInquiry(
  sb: SupabaseClient,
  adapter: HubAdapter,
  ctx: InquiryContext,
): Promise<{ heard: boolean }> {
  const { submission, settings } = ctx;
  const ending = submission.stage === "waitlisted" ? "waitlisted" : "completed";
  const href = staffHref(adapter, submission);
  const notice = newInquiryNotice({ headline: headlineFor(ctx), ending });

  let inAppSent = false;
  if (settings.notify.inApp) {
    try {
      await adapter.notifyStaff(sb, { kind: "web_inquiry", title: notice.title, body: notice.body, href });
      inAppSent = true;
      await writeLog(sb, { submissionId: submission.id, kind: LOG_KINDS.staffNotify, status: "sent", channel: "in_app", detail: { href } });
    } catch (err) {
      await writeLog(sb, {
        submissionId: submission.id,
        kind: LOG_KINDS.staffNotify,
        status: "failed",
        channel: "in_app",
        detail: { error: errorText(err) },
      });
    }
  } else {
    await writeLog(sb, {
      submissionId: submission.id,
      kind: LOG_KINDS.staffNotify,
      status: "skipped",
      channel: "in_app",
      detail: { reason: "In-app alerts are off for this form." },
    });
  }

  // The form's recipients plus the owner its event type routes to (settings.ownerByEventType).
  const recipients = staffRecipients(
    settings.notify.recipients.map((r) => normalizeEmail(r)).filter((r): r is string => Boolean(r)),
    ownerFor(settings, ctx.definition, submission.answers),
  );
  let emailSent = false;
  if (recipients.length > 0) {
    const email = staffEmailFor(ctx, `${adapter.publicOrigin()}${href}`);
    for (const to of recipients) {
      try {
        const result = await adapter.sendEmail({ to: [to], subject: email.subject, text: email.text, html: email.html });
        if (result.ok) emailSent = true;
        await writeLog(sb, {
          submissionId: submission.id,
          kind: LOG_KINDS.staffEmail,
          status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
          channel: "email",
          recipient: to,
          detail: result.ok ? { subject: email.subject } : { subject: email.subject, error: (result.error ?? "").slice(0, 500) },
        });
      } catch (err) {
        await writeLog(sb, {
          submissionId: submission.id,
          kind: LOG_KINDS.staffEmail,
          status: "failed",
          channel: "email",
          recipient: to,
          detail: { error: errorText(err) },
        });
      }
    }
  }

  const nothingConfigured = !settings.notify.inApp && recipients.length === 0;
  return { heard: inAppSent || emailSent || nothingConfigured };
}

/** The visitor's copy (only when the form turned it on and we have an email). Stamps confirmation_sent_at. */
export async function sendInquiryConfirmation(
  sb: SupabaseClient,
  adapter: HubAdapter,
  ctx: InquiryContext,
): Promise<"sent" | "failed" | "skipped"> {
  const { submission, settings } = ctx;
  const to = normalizeEmail(submission.contact_email);
  if (!settings.confirmationEmail.enabled || !to) {
    await writeLog(sb, {
      submissionId: submission.id,
      kind: LOG_KINDS.confirmation,
      status: "skipped",
      channel: "email",
      detail: { reason: settings.confirmationEmail.enabled ? "No email address." : "Confirmation email is off for this form." },
    });
    return "skipped";
  }
  const sentFromIp = await countHit(sb, RATE_KEYS.confirmations(submission.ip_hash), easternDayWindowStart(new Date()));
  if (overLimit(sentFromIp, MAX_CONFIRMATIONS_PER_IP_PER_DAY)) {
    await writeLog(sb, {
      submissionId: submission.id,
      kind: LOG_KINDS.confirmation,
      status: "skipped",
      channel: "email",
      detail: { reason: "Daily confirmation email limit for this visitor's network was reached." },
    });
    return "skipped";
  }
  const email = confirmationEmailFor(ctx);
  try {
    const result = await adapter.sendEmail({
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: ctx.brand.email,
    });
    const status = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
    await writeLog(sb, {
      submissionId: submission.id,
      kind: LOG_KINDS.confirmation,
      status,
      channel: "email",
      recipient: to,
      detail: result.ok ? { subject: email.subject } : { subject: email.subject, error: (result.error ?? "").slice(0, 500) },
    });
    if (result.ok) {
      const { error } = await sb
        .from(TABLES.submissions)
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", submission.id);
      if (error) console.error("[inquiry-forms] confirmation stamp failed", submission.id, error.message);
    }
    return status;
  } catch (err) {
    await writeLog(sb, {
      submissionId: submission.id,
      kind: LOG_KINDS.confirmation,
      status: "failed",
      channel: "email",
      recipient: to,
      detail: { error: errorText(err) },
    });
    return "failed";
  }
}

/** In-app alert (kind web_inquiry_unfinished) for an abandoned submission. true = delivered. */
export async function notifyStaffOfUnfinished(
  sb: SupabaseClient,
  adapter: HubAdapter,
  input: { submission: SubmissionRecord; formName: string; definition: FormDefinition | null },
): Promise<boolean> {
  const { submission, definition } = input;
  const stepIndex = Math.max(0, Math.min(submission.current_step, Math.max(0, submission.total_steps - 1)));
  const notice = unfinishedNotice({
    who: submission.contact_name,
    email: submission.contact_email,
    phone: submission.contact_phone,
    formName: input.formName,
    stepIndex,
    totalSteps: submission.total_steps,
    stepTitle: definition?.steps[stepIndex]?.title ?? null,
  });
  const href = submissionHref(submission.form_id, submission.id);
  try {
    await adapter.notifyStaff(sb, { kind: "web_inquiry_unfinished", title: notice.title, body: notice.body, href });
    await writeLog(sb, { submissionId: submission.id, kind: LOG_KINDS.abandonAlert, status: "sent", channel: "in_app", detail: { href } });
    return true;
  } catch (err) {
    await writeLog(sb, {
      submissionId: submission.id,
      kind: LOG_KINDS.abandonAlert,
      status: "failed",
      channel: "in_app",
      detail: { error: errorText(err) },
    });
    return false;
  }
}
