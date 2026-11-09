import "server-only";

/**
 * Inquiry Forms - the one way any caller creates a submission's CRM record (the completion side
 * effects, the sweep re-drive and the staff "Add to Leads" action). Binds crm-claim-core's
 * runCrmWrite to the database and the hub adapter: claim first, write once, release on failure.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCrmSummary, formatAnswerLines } from "../answers";
import type { FormDefinition, SubmissionRow } from "../types";
import { hubAdapter } from "./adapter";
import { crmEndingFor, refFromLogDetail, runCrmWrite, type CrmWriteResult, type CrmWriter } from "./crm-claim-core";
import { claimCrmWrite, countLog, latestLogDetails, loadSubmission, releaseCrmClaim, saveCrmRef, writeLog } from "./db";
import { LOG_KINDS } from "./schema-core";

export type { CrmWriteResult, CrmWriter } from "./crm-claim-core";

/** Log kinds whose successful rows hold a created CRM record's ref (automatic and staff). */
export const CRM_LOG_KINDS = [LOG_KINDS.crmRecord, LOG_KINDS.crmManual];

export async function writeCrmRecord(
  sb: SupabaseClient,
  input: {
    writer: CrmWriter;
    /** The submission as the caller loaded it (contract shape: no token or IP hash). */
    submission: SubmissionRow;
    form: { id: string; name: string; slug: string };
    /** The definition the visitor filled (labels for the CRM message). */
    definition: FormDefinition;
    /** Staff writes: who clicked (logged as crm_manual with their name). */
    actor?: { id: string; name: string } | null;
    /** Owner routed by event type (form settings), set as the record's owner when they have a login. */
    ownerEmail?: string | null;
  },
): Promise<CrmWriteResult> {
  const { writer, submission: sub, form, definition } = input;
  const ownerEmail = input.ownerEmail ?? null;
  const actor = writer === "staff" ? (input.actor ?? null) : null;
  const kind = writer === "staff" ? LOG_KINDS.crmManual : LOG_KINDS.crmRecord;
  const summary = buildCrmSummary(definition, sub.answers, sub.qualification, crmEndingFor(sub.stage), sub.score_label);
  const lines = formatAnswerLines(definition, sub.answers);

  return runCrmWrite(writer, sub.crm_ref, {
    loggedRefs: async () => (await latestLogDetails(sb, sub.id, CRM_LOG_KINDS, "sent")).map(refFromLogDetail),
    autoAttempts: () => countLog(sb, sub.id, LOG_KINDS.crmRecord),
    claim: (takeoverSeconds) => claimCrmWrite(sb, sub.id, takeoverSeconds),
    currentRef: async () => (await loadSubmission(sb, sub.id))?.crm_ref ?? {},
    // The claim's own crm_ref: a half-done write since the caller's read left a client to reuse.
    record: (crmRef) =>
      hubAdapter.recordInquiry(sb, { submission: { ...sub, crm_ref: crmRef }, form, summary, lines, ownerEmail }),
    saveRef: (ref) => saveCrmRef(sb, sub.id, ref),
    release: (token, ref) => releaseCrmClaim(sb, sub.id, token, ref),
    log: async (status, detail) => {
      if (status === "failed") console.error(`[inquiry-forms] CRM write by ${writer} failed`, sub.id, detail.error);
      await writeLog(sb, {
        submissionId: sub.id,
        kind,
        status,
        channel: "crm",
        recipient: actor?.name ?? null,
        detail: actor ? { ...detail, by: actor.id } : detail,
      });
    },
  });
}
