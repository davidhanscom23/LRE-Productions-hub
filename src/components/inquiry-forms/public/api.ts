/**
 * Inquiry Forms public renderer - browser API client for /api/inquire/*.
 *
 * Every call resolves (never throws) to `{ ok: true, ...data }` or an `ApiFailure` with a message the
 * visitor can act on. Paths are relative: the page and the API share the hub origin, also inside the
 * embed iframe.
 */
import type {
  CompleteRequest,
  CompleteResponse,
  PingRequest,
  PreviewQualifyRequest,
  QualifyResponse,
  SaveRequest,
  SaveResponse,
  StartRequest,
  StartResponse,
  ViewRequest,
} from "@/lib/inquiry-forms/types";

export interface ApiFailure {
  ok: false;
  /** HTTP status, 0 for network errors and timeouts. */
  status: number;
  error: string;
  fieldErrors?: Record<string, string>;
  retryable: boolean;
  /** Optional server hint: the step the field errors belong to. */
  stepIndex?: number;
}

export type ApiResult<T extends { ok: true }> = T | ApiFailure;

type FetchLike = typeof fetch;

export const NETWORK_ERROR = "We couldn't reach our server. Check your connection, then try again.";
export const TIMEOUT_ERROR = "This is taking longer than it should. Check your connection, then try again.";

interface PostOptions {
  timeoutMs?: number;
  /** Message when the server gives no usable one. */
  fallbackError: string;
  fetchImpl?: FetchLike;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringRecord(v: unknown): Record<string, string> | undefined {
  if (!isRecord(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && val.trim()) out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

/** POST JSON and normalize the answer. Exported for tests. */
export async function postJson<T extends { ok: true }>(
  url: string,
  body: unknown,
  opts: PostOptions,
): Promise<ApiResult<T>> {
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timedOut = false;
  const timer = controller
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, opts.timeoutMs ?? 20000)
    : null;
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
      signal: controller?.signal,
    });
  } catch {
    if (timer) clearTimeout(timer);
    return { ok: false, status: 0, error: timedOut ? TIMEOUT_ERROR : NETWORK_ERROR, retryable: true };
  }
  if (timer) clearTimeout(timer);

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.ok && isRecord(data) && data.ok === true) return data as T;

  const rec = isRecord(data) ? data : {};
  const error = typeof rec.error === "string" && rec.error.trim() ? rec.error : opts.fallbackError;
  const retryable =
    typeof rec.retryable === "boolean" ? rec.retryable : res.status === 0 || res.status >= 500 || res.status === 429;
  const failure: ApiFailure = { ok: false, status: res.status, error, retryable };
  const fieldErrors = stringRecord(rec.fieldErrors);
  if (fieldErrors) failure.fieldErrors = fieldErrors;
  if (typeof rec.stepIndex === "number" && Number.isInteger(rec.stepIndex)) failure.stepIndex = rec.stepIndex;
  return failure;
}

/** True when a failure means the submission token is no longer accepted (session must restart). */
export function isSessionGone(f: ApiFailure): boolean {
  return f.status === 401 || f.status === 403 || f.status === 404 || f.status === 410;
}

const SAVE_ERROR = "We couldn't save your answers. Try again in a moment.";
const CHECK_ERROR = "We couldn't check availability just now. Try again in a moment.";
const SEND_ERROR = "We couldn't send your request. Try again in a moment.";

const enc = encodeURIComponent;

export function startSubmission(body: StartRequest, fetchImpl?: FetchLike) {
  return postJson<StartResponse>("/api/inquire/start", body, { fallbackError: SAVE_ERROR, fetchImpl });
}

export function saveStep(submissionId: string, body: SaveRequest, fetchImpl?: FetchLike) {
  return postJson<SaveResponse>(`/api/inquire/${enc(submissionId)}/save`, body, {
    fallbackError: SAVE_ERROR,
    fetchImpl,
  });
}

export function qualifySubmission(submissionId: string, token: string, fetchImpl?: FetchLike) {
  return postJson<QualifyResponse>(
    `/api/inquire/${enc(submissionId)}/qualify`,
    { token },
    { fallbackError: CHECK_ERROR, timeoutMs: 30000, fetchImpl },
  );
}

/** Admin dry run of the draft: availability is real, nothing is saved. */
export function previewQualify(
  body: PreviewQualifyRequest & { formId: string; formSlug: string },
  fetchImpl?: FetchLike,
) {
  return postJson<QualifyResponse>("/api/inquire/preview/qualify", body, {
    fallbackError: CHECK_ERROR,
    timeoutMs: 30000,
    fetchImpl,
  });
}

export function completeSubmission(submissionId: string, body: CompleteRequest, fetchImpl?: FetchLike) {
  return postJson<CompleteResponse>(`/api/inquire/${enc(submissionId)}/complete`, body, {
    fallbackError: SEND_ERROR,
    timeoutMs: 30000,
    fetchImpl,
  });
}

/**
 * Fire-and-forget POST for heartbeats and the view count. Uses sendBeacon (text/plain JSON, survives
 * pagehide) and falls back to a keepalive fetch. Never throws.
 */
export function beaconJson(url: string, body: unknown, preferBeacon: boolean): void {
  const payload = JSON.stringify(body);
  try {
    if (preferBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(url, payload)) return;
    }
  } catch {
    // fall through to fetch
  }
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    // nothing else to try; a missed heartbeat only delays the abandonment alert
  }
}

export function pingSubmission(submissionId: string, token: string, preferBeacon: boolean): void {
  const body: PingRequest = { token };
  beaconJson(`/api/inquire/${enc(submissionId)}/ping`, body, preferBeacon);
}

/** One view per tab session (the caller guards repeats). */
export function sendView(formSlug: string, formId: string): void {
  const body: ViewRequest = { formSlug, formId };
  beaconJson("/api/inquire/view", body, true);
}
