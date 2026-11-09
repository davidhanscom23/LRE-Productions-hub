import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  completeSubmission,
  isSessionGone,
  postJson,
  saveStep,
  startSubmission,
} from "./api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("postJson", () => {
  it("returns the server's ok payload", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, currentStep: 2 }));
    const res = await postJson<{ ok: true; currentStep: number }>("/x", { a: 1 }, { fallbackError: "fb", fetchImpl });
    expect(res).toEqual({ ok: true, currentStep: 2 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/x");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("passes through the server's message, field errors, retryable flag and step hint", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, { ok: false, error: "Check the highlighted fields.", fieldErrors: { email: "Enter a valid email", bad: 3 }, retryable: false, stepIndex: 0 }),
    );
    const res = await postJson("/x", {}, { fallbackError: "fb", fetchImpl });
    expect(res).toEqual({
      ok: false,
      status: 422,
      error: "Check the highlighted fields.",
      fieldErrors: { email: "Enter a valid email" },
      retryable: false,
      stepIndex: 0,
    });
  });

  it("uses the fallback message for a non-JSON 500 and marks it retryable", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>oops</html>", { status: 500 }));
    const res = await postJson("/x", {}, { fallbackError: "We couldn't save your answers.", fetchImpl });
    expect(res).toMatchObject({ ok: false, status: 500, error: "We couldn't save your answers.", retryable: true });
  });

  it("never treats a 200 without ok:true as success", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { submissionId: "x" }));
    const res = await postJson("/x", {}, { fallbackError: "fb", fetchImpl });
    expect(res.ok).toBe(false);
  });

  it("reports network failures as retryable with a plain message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const res = await postJson("/x", {}, { fallbackError: "fb", fetchImpl });
    expect(res).toEqual({ ok: false, status: 0, error: NETWORK_ERROR, retryable: true });
  });

  it("times out slow requests", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = postJson("/x", {}, { fallbackError: "fb", fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    expect(await pending).toEqual({ ok: false, status: 0, error: TIMEOUT_ERROR, retryable: true });
  });
});

describe("endpoint helpers", () => {
  it("address the documented routes", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true }));
    await startSubmission(
      { formSlug: "check-your-date", answers: {}, attribution: {}, hp: "", elapsedMs: 5000 },
      fetchImpl as unknown as typeof fetch,
    );
    await saveStep("sub 1", { token: "t", stepIndex: 2, answers: {} }, fetchImpl as unknown as typeof fetch);
    await completeSubmission("sub-1", { token: "t", answers: {}, ending: "completed" }, fetchImpl as unknown as typeof fetch);
    const urls = (fetchImpl.mock.calls as unknown as [string][]).map((c) => c[0]);
    expect(urls).toEqual(["/api/inquire/start", "/api/inquire/sub%201/save", "/api/inquire/sub-1/complete"]);
  });
});

describe("isSessionGone", () => {
  it("is true only for auth / missing submission statuses", () => {
    for (const status of [401, 403, 404, 410]) expect(isSessionGone({ ok: false, status, error: "", retryable: false })).toBe(true);
    for (const status of [0, 400, 409, 422, 429, 500]) expect(isSessionGone({ ok: false, status, error: "", retryable: true })).toBe(false);
  });
});
