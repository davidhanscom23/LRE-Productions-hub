// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { replyToList, sendEmailDetailed } from "./send";

const fetchMock = vi.fn();

function sentBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
  return JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Vident Productions <hello@videntproductions.com>");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("replyToList", () => {
  it("keeps trimmed, non-empty addresses", () => {
    expect(replyToList(" hello@videntproductions.com ")).toEqual(["hello@videntproductions.com"]);
    expect(replyToList(["a@x.com", " ", "b@x.com"])).toEqual(["a@x.com", "b@x.com"]);
    expect(replyToList(null)).toEqual([]);
    expect(replyToList(undefined)).toEqual([]);
    expect(replyToList("   ")).toEqual([]);
  });
});

describe("sendEmailDetailed reply_to", () => {
  it("sends Resend reply_to when replyTo is set", async () => {
    const result = await sendEmailDetailed({
      to: "jane@example.com",
      subject: "We received your request",
      text: "Thanks",
      replyTo: "hello@videntproductions.com",
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody()).toMatchObject({
      to: ["jane@example.com"],
      subject: "We received your request",
      reply_to: "hello@videntproductions.com",
    });
  });

  it("passes several Reply-To addresses as a list", async () => {
    await sendEmailDetailed({ to: ["a@example.com"], subject: "s", text: "t", replyTo: ["x@example.com", "y@example.com"] });
    expect(sentBody().reply_to).toEqual(["x@example.com", "y@example.com"]);
  });

  it("sends no reply_to when it is missing or blank (old callers are unchanged)", async () => {
    await sendEmailDetailed({ to: "a@example.com", subject: "s", text: "t" });
    await sendEmailDetailed({ to: "a@example.com", subject: "s", text: "t", replyTo: "  " });
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse((call[1] as { body: string }).body) as Record<string, unknown>;
      expect(body).not.toHaveProperty("reply_to");
    }
  });

  it("still skips without Resend settings", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendEmailDetailed({ to: "a@example.com", subject: "s", text: "t", replyTo: "hello@videntproductions.com" });
    expect(result.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
