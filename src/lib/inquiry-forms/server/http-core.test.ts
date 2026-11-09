import { describe, expect, it } from "vitest";
import { crossOriginRejection, emptyResponse, errorBody, jsonResponse, readJsonBody } from "./http-core";

function post(body: string | null, headers: Record<string, string>): Request {
  return new Request("https://hub.example.com/api/inquire/start", { method: "POST", body, headers });
}

describe("responses", () => {
  it("never caches and never opens CORS", async () => {
    const res = jsonResponse(200, { ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(await res.json()).toEqual({ ok: true });
    const empty = emptyResponse();
    expect(empty.status).toBe(204);
    expect(empty.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("shapes errors like ErrorResponse", () => {
    expect(errorBody("Nope", { retryable: true })).toEqual({ ok: false, error: "Nope", retryable: true });
  });
});

describe("readJsonBody", () => {
  it("reads JSON", async () => {
    const r = await readJsonBody(post('{"a":1}', { "content-type": "application/json; charset=utf-8" }));
    expect(r).toEqual({ ok: true, value: { a: 1 } });
  });

  it("accepts text/plain only where sendBeacon is allowed", async () => {
    expect((await readJsonBody(post('{"token":"t"}', { "content-type": "text/plain;charset=UTF-8" }))).ok).toBe(false);
    const beacon = await readJsonBody(post('{"token":"t"}', { "content-type": "text/plain;charset=UTF-8" }), {
      allowTextPlain: true,
    });
    expect(beacon).toEqual({ ok: true, value: { token: "t" } });
  });

  it("refuses other content types, bad JSON and empty bodies", async () => {
    expect(await readJsonBody(post("a=1", { "content-type": "application/x-www-form-urlencoded" }))).toMatchObject({
      ok: false,
      status: 415,
    });
    expect(await readJsonBody(post("{nope", { "content-type": "application/json" }))).toMatchObject({ ok: false, status: 400 });
    expect(await readJsonBody(post("", { "content-type": "application/json" }))).toMatchObject({ ok: false, status: 400 });
  });

  it("caps the body at 64 KB", async () => {
    const big = JSON.stringify({ a: "x".repeat(70 * 1024) });
    expect(await readJsonBody(post(big, { "content-type": "application/json" }))).toMatchObject({ ok: false, status: 413 });
    const small = JSON.stringify({ a: "x".repeat(60 * 1024) });
    expect((await readJsonBody(post(small, { "content-type": "application/json" }))).ok).toBe(true);
  });
});

describe("crossOriginRejection", () => {
  it("lets same-origin and origin-less requests through", () => {
    expect(
      crossOriginRejection(post("{}", { origin: "https://hub.example.com", host: "hub.example.com" })),
    ).toBeNull();
    expect(crossOriginRejection(post("{}", { host: "hub.example.com" }))).toBeNull();
    expect(
      crossOriginRejection(
        post("{}", {
          origin: "https://hub.example.com",
          host: "internal",
          "x-forwarded-host": "hub.example.com",
        }),
      ),
    ).toBeNull();
  });

  it("refuses other sites and opaque origins", () => {
    expect(crossOriginRejection(post("{}", { origin: "https://evil.example", host: "hub.example.com" }))?.status).toBe(403);
    expect(crossOriginRejection(post("{}", { origin: "null", host: "hub.example.com" }))?.status).toBe(403);
  });
});
