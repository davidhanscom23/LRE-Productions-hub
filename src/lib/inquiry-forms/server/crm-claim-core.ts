/**
 * Inquiry Forms - one CRM record per inquiry, whoever writes it. PURE: the database and the hub
 * adapter come in as functions (CrmWriteDeps), so the race between writers is tested with fakes.
 *
 * Three writers can create the Leads card of one submission, possibly at the same moment:
 * - "completion": the after() side effects of the request that finished the form,
 * - "sweep": the cron re-drive of finished inquiries whose CRM write never logged success,
 * - "staff": the "Add to Leads" button in the submission drawer.
 * Each one first CLAIMS the write atomically (Inquiry Forms migration, inquiry_crm_claim: set
 * crm_claimed_at = now() where it is null and crm_ref holds no complete record, returning the row).
 * Only the claim holder calls recordInquiry. A failed write releases the claim (crm_claimed_at =
 * null) so the next writer can retry. A successful one keeps it, and logs the new ref before
 * linking it, so a lost link is re-linked from the log and never written twice.
 */
import { CRM_PARTIAL_KEY, crmRefDone, isPlainObject } from "./lifecycle-core";

export type CrmWriter = "completion" | "sweep" | "staff";

/**
 * A claim older than this is abandoned: its holder is gone (the complete route runs for at most
 * 30 s, the sweep 60 s, a server action a few minutes).
 */
export const CRM_CLAIM_STALE_MS = 10 * 60 * 1000;

/** Automatic writers (completion and sweep) stop after this many logged attempts. */
export const MAX_AUTO_CRM_ATTEMPTS = 3;

/** Non-empty string values only (the shape crm_ref and log details store). */
export function stringRef(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isPlainObject(value)) return out;
  for (const [k, v] of Object.entries(value)) if (typeof v === "string" && v) out[k] = v;
  return out;
}

/** The crm_ref a successful CRM log row recorded (detail.ref; older staff rows used detail.crm_ref). */
export function refFromLogDetail(detail: unknown): Record<string, string> {
  if (!isPlainObject(detail)) return {};
  return stringRef(detail.ref ?? detail.crm_ref);
}

/** The CrmSummary ending for a submission stage (anything unfinished is a partial). */
export function crmEndingFor(stage: string): "completed" | "waitlisted" | "partial" {
  if (stage === "completed") return "completed";
  if (stage === "waitlisted") return "waitlisted";
  return "partial";
}

/**
 * Seconds after which this writer may take over another writer's claim (null = never). Completion
 * runs seconds after the form was sent, so a claim it meets is live. The sweep and staff take over
 * a claim whose holder died mid-write; without that the inquiry could never get its card.
 */
export function claimTakeoverSeconds(writer: CrmWriter): number | null {
  return writer === "completion" ? null : CRM_CLAIM_STALE_MS / 1000;
}

export type CrmPlan =
  | { step: "done"; ref: Record<string, string> }
  | { step: "relink"; ref: Record<string, string> }
  | { step: "gave_up" }
  | { step: "claim" };

/**
 * What a writer does before touching the CRM:
 * - done: crm_ref is complete (the drawer says "Already in Leads"),
 * - relink: a logged write created the record but its link was never stored: store that ref and
 *   write nothing,
 * - gave_up: an automatic writer used up its attempts (staff can always try again),
 * - claim: claim the write, then create the record.
 */
export function planCrmWrite(input: {
  writer: CrmWriter;
  crmRef: unknown;
  /** crm_refs from the newest successful CRM log rows. */
  loggedRefs: unknown[];
  /** Logged automatic attempts (inquiry_log kind crm_record). */
  autoAttempts: number;
  maxAutoAttempts?: number;
}): CrmPlan {
  const current = stringRef(input.crmRef);
  if (crmRefDone(current)) return { step: "done", ref: current };
  for (const logged of input.loggedRefs) {
    const ref = stringRef(logged);
    if (crmRefDone(ref)) return { step: "relink", ref };
  }
  const max = input.maxAutoAttempts ?? MAX_AUTO_CRM_ATTEMPTS;
  if (input.writer !== "staff" && input.autoAttempts >= max) return { step: "gave_up" };
  return { step: "claim" };
}

export interface CrmClaim {
  /** crm_claimed_at exactly as the database stored it: the release matches on it. */
  token: string;
  /** crm_ref at the moment of the claim (a partial ref keeps the client for the retry). */
  crmRef: Record<string, string>;
}

/** The inquiry_crm_claim answer: {claimed_at, crm_ref} when claimed, null when not. */
export function readClaim(raw: unknown): CrmClaim | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!isPlainObject(value)) return null;
  const token = typeof value.claimed_at === "string" ? value.claimed_at.trim() : "";
  if (!token) return null;
  return { token, crmRef: stringRef(value.crm_ref) };
}

/** true while a write is probably running: claimed recently and no complete record yet. */
export function crmWriteInFlight(input: { crmRef: unknown; claimedAt: string | null | undefined }, now: Date): boolean {
  if (crmRefDone(input.crmRef)) return false;
  const at = Date.parse(input.claimedAt ?? "");
  return Number.isFinite(at) && now.getTime() - at < CRM_CLAIM_STALE_MS;
}

/**
 * crm_ref to store with the released claim after a failed write: what the adapter already made
 * (the client) marked partial, so the retry reuses it. null = leave crm_ref as it is.
 */
export function refAfterFailure(claimed: Record<string, string>, partialRef: unknown): Record<string, string> | null {
  const partial = stringRef(partialRef);
  if (Object.keys(partial).length === 0) return null;
  return { ...claimed, ...partial, [CRM_PARTIAL_KEY]: "true" };
}

// ---------------------------------------------------------------------------
// The write itself (I/O injected)
// ---------------------------------------------------------------------------

export interface CrmWriteDeps {
  /** crm_refs (log detail.ref) of the newest successful CRM log rows, automatic and staff. */
  loggedRefs(): Promise<unknown[]>;
  /** Logged automatic attempts. Only asked for automatic writers. */
  autoAttempts(): Promise<number>;
  /** inquiry_crm_claim(id, takeover seconds): the raw answer. */
  claim(takeoverSeconds: number | null): Promise<unknown>;
  /** The submission's crm_ref right now (read after losing the claim). */
  currentRef(): Promise<unknown>;
  /** adapter.recordInquiry with this crm_ref. Throws on failure (err.partialRef = what was made). */
  record(crmRef: Record<string, string>): Promise<Record<string, string>>;
  /** Store crm_ref. Never throws; false when it was not stored. */
  saveRef(ref: Record<string, string>): Promise<boolean>;
  /** Clear crm_claimed_at where it still equals `token` (and store `ref` when given). Never throws. */
  release(token: string, ref: Record<string, string> | null): Promise<boolean>;
  /** One inquiry_log row for this write. Never throws. */
  log(status: "sent" | "failed", detail: Record<string, unknown>): Promise<void>;
}

export type CrmWriteResult =
  | { outcome: "done" | "relinked" | "created"; ref: Record<string, string> }
  | { outcome: "busy" | "gave_up"; ref: Record<string, string> }
  | { outcome: "failed"; ref: Record<string, string>; error: string };

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

async function quietly<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/**
 * Create the CRM record of one submission at most once across every writer. `crmRef` is the
 * submission's crm_ref as the caller loaded it.
 */
export async function runCrmWrite(writer: CrmWriter, crmRef: unknown, deps: CrmWriteDeps): Promise<CrmWriteResult> {
  const current = stringRef(crmRef);
  if (crmRefDone(current)) return { outcome: "done", ref: current };

  const plan = planCrmWrite({
    writer,
    crmRef: current,
    loggedRefs: await deps.loggedRefs(),
    autoAttempts: writer === "staff" ? 0 : await deps.autoAttempts(),
  });
  if (plan.step === "done") return { outcome: "done", ref: plan.ref };
  if (plan.step === "relink") {
    // If this save fails too, the log row still holds the ref for the next writer.
    await quietly(() => deps.saveRef(plan.ref), false);
    return { outcome: "relinked", ref: plan.ref };
  }
  if (plan.step === "gave_up") return { outcome: "gave_up", ref: current };

  const claim = readClaim(await deps.claim(claimTakeoverSeconds(writer)));
  if (!claim) {
    // Someone else holds the write, or finished it a moment ago.
    const now = stringRef(await deps.currentRef());
    return crmRefDone(now) ? { outcome: "done", ref: now } : { outcome: "busy", ref: now };
  }

  let ref: Record<string, string>;
  try {
    ref = stringRef(await deps.record(claim.crmRef));
  } catch (err) {
    const error = errorText(err);
    const partialRef = err && typeof err === "object" ? (err as { partialRef?: unknown }).partialRef : undefined;
    const next = refAfterFailure(claim.crmRef, partialRef);
    await quietly(() => deps.release(claim.token, next), false);
    await quietly(() => deps.log("failed", { error, partialRef: stringRef(partialRef) }), undefined);
    return { outcome: "failed", ref: next ?? claim.crmRef, error };
  }
  // The record exists now: whatever happens below, the claim stays (no second write).
  await quietly(() => deps.log("sent", { ref }), undefined);
  await quietly(() => deps.saveRef(ref), false);
  return { outcome: "created", ref };
}
