/**
 * Inquiry Forms - HTTP helpers for the /api/inquire/* route handlers. PURE (Web Request/Response
 * only, no Next imports), so vitest can exercise them.
 *
 * Rules: JSON bodies capped at 64 KB; no-store on every response; same-origin only (no
 * Access-Control-Allow-Origin is ever sent, and a request whose Origin is another site is refused).
 */
import type { ErrorResponse } from "../types";

/** Request bodies are capped (the answers of one step are tiny). */
export const MAX_BODY_BYTES = 64 * 1024;

export const NO_STORE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
});

export function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...(headers ?? {}) },
  });
}

export function emptyResponse(status = 204): Response {
  return new Response(null, { status, headers: { ...NO_STORE_HEADERS } });
}

export function errorBody(error: string, extra?: Omit<ErrorResponse, "ok" | "error">): ErrorResponse {
  return { ok: false, error, ...(extra ?? {}) };
}

export type BodyResult = { ok: true; value: unknown } | { ok: false; status: number; error: string };

function mediaType(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * Read a JSON body: application/json (or text/plain when `allowTextPlain`, which is what
 * navigator.sendBeacon sends for a string), at most `maxBytes`, parsed with JSON.parse.
 */
export async function readJsonBody(
  request: Request,
  opts: { allowTextPlain?: boolean; maxBytes?: number } = {},
): Promise<BodyResult> {
  const max = opts.maxBytes ?? MAX_BODY_BYTES;
  const type = mediaType(request.headers.get("content-type"));
  const typeOk = type === "application/json" || (opts.allowTextPlain === true && (type === "text/plain" || type === ""));
  if (!typeOk) return { ok: false, status: 415, error: "Send the request as JSON." };

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    return { ok: false, status: 413, error: "The request is too large." };
  }

  let text = "";
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413, error: "The request is too large." };
      }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      all.set(chunk, at);
      at += chunk.byteLength;
    }
    text = new TextDecoder("utf-8").decode(all);
  }

  if (!text.trim()) return { ok: false, status: 400, error: "The request was empty." };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "The request was not valid JSON." };
  }
}

/**
 * Same-origin only. A browser always sends Origin on a POST; when it names another site (or
 * "null"), refuse. Requests without an Origin (server to server, curl) pass to the token checks.
 */
export function crossOriginRejection(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  let originHost = "";
  try {
    originHost = origin === "null" ? "" : new URL(origin).host.toLowerCase();
  } catch {
    originHost = "";
  }
  if (originHost && host && originHost === host) return null;
  return jsonResponse(403, errorBody("This form only accepts requests from its own page."));
}
