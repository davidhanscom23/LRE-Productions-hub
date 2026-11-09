import "server-only";

/**
 * Inquiry Forms - the emails a finished inquiry can send, built from the ONE answer formatter
 * (formatAnswerLines) and the pure templates in emails-core.ts.
 */
import { answerDisplay, formatAnswerLines } from "../answers";
import { findRoleField } from "../definition";
import { formatEasternTimestamp } from "../dates";
import type { BrandProfile, BusinessSettings, FormDefinition, FormSettings } from "../types";
import type { SubmissionRecord } from "./db";
import { buildConfirmationEmail, buildStaffEmail, qualificationLines, type EmailContent } from "./emails-core";
import { budgetLabelOf, inquiryHeadline } from "./lifecycle-core";

export interface InquiryContext {
  submission: SubmissionRecord;
  form: { id: string; name: string; slug: string };
  definition: FormDefinition;
  settings: FormSettings;
  business: BusinessSettings;
  brand: BrandProfile;
}

/** "Ann Lee - Wedding on Saturday, May 15, 2027 (high fit)" for alerts and subjects. */
export function headlineFor(ctx: InquiryContext): string {
  const { submission, definition } = ctx;
  const typeField = findRoleField(definition, "event_type");
  return inquiryHeadline({
    name: submission.contact_name,
    email: submission.contact_email,
    phone: submission.contact_phone,
    eventType: typeField ? answerDisplay(typeField, submission.answers) : null,
    eventDate: submission.event_date,
    scoreLabel: submission.score_label,
  });
}

export function staffEmailFor(ctx: InquiryContext, hubLink: string): EmailContent {
  const { submission, definition } = ctx;
  return buildStaffEmail({
    formName: ctx.form.name,
    ending: submission.stage === "waitlisted" ? "waitlisted" : "completed",
    headline: headlineFor(ctx),
    contact: { name: submission.contact_name, email: submission.contact_email, phone: submission.contact_phone },
    qualification: qualificationLines({
      qualification: submission.qualification,
      score: submission.score,
      scoreLabel: submission.score_label,
      budgetLabel: budgetLabelOf(definition, submission.answers),
    }),
    answers: formatAnswerLines(definition, submission.answers),
    attribution: submission.attribution,
    submittedAt: formatEasternTimestamp(submission.completed_at ?? new Date().toISOString()),
    hubLink,
  });
}

export function confirmationEmailFor(ctx: InquiryContext): EmailContent {
  return buildConfirmationEmail({
    brand: ctx.brand,
    name: ctx.submission.contact_name,
    subject: ctx.settings.confirmationEmail.subject,
    intro: ctx.settings.confirmationEmail.intro,
    emojiPrefix: ctx.business.emojiPrefix,
    answers: formatAnswerLines(ctx.definition, ctx.submission.answers),
  });
}
