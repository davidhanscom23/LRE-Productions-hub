import { describe, expect, it } from "vitest";

import {
  buildMessageKey,
  externalParticipants,
  isAutomatedMessage,
  isInternalAddress,
  parseAddresses,
  stripQuotedReply,
} from "@/lib/honeybook/gmail/rules";

describe("parseAddresses", () => {
  it("pulls lowercase unique addresses out of header values", () => {
    expect(
      parseAddresses('"Jane Doe" <Jane@Example.com>, Bob <bob@x.org>, jane@example.com'),
    ).toEqual(["jane@example.com", "bob@x.org"]);
  });
  it("handles empty input", () => {
    expect(parseAddresses(undefined)).toEqual([]);
    expect(parseAddresses("")).toEqual([]);
  });
});

describe("isInternalAddress", () => {
  it("recognizes both LRE domains", () => {
    expect(isInternalAddress("hello@lreproductions.com")).toBe(true);
    expect(isInternalAddress("hello@lreproductions.com")).toBe(true);
    expect(isInternalAddress("client@gmail.com")).toBe(false);
    expect(isInternalAddress("x@notlreproductions.com")).toBe(false);
  });
});

describe("isAutomatedMessage", () => {
  it("skips no-reply senders and system domains", () => {
    expect(isAutomatedMessage({}, "no-reply@somebank.com")).toBe(true);
    expect(isAutomatedMessage({}, "calendar-notification@google.com")).toBe(true);
    expect(isAutomatedMessage({}, "hello@honeybook.com")).toBe(true);
  });
  it("skips bulk mail by header", () => {
    expect(isAutomatedMessage({ "list-unsubscribe": "<mailto:x@y.z>" }, "a@b.com")).toBe(true);
    expect(isAutomatedMessage({ precedence: "bulk" }, "a@b.com")).toBe(true);
    expect(isAutomatedMessage({ "auto-submitted": "auto-replied" }, "a@b.com")).toBe(true);
  });
  it("lets a normal person through", () => {
    expect(isAutomatedMessage({ "auto-submitted": "no" }, "jane@example.com")).toBe(false);
  });
});

describe("externalParticipants", () => {
  it("drops LRE staff and automated addresses", () => {
    expect(
      externalParticipants({
        from: "jane@example.com",
        to: ["hello@lreproductions.com", "noreply@zoom.us"],
        cc: ["bob@client.org"],
      }),
    ).toEqual(["jane@example.com", "bob@client.org"]);
  });
});

describe("buildMessageKey", () => {
  it("uses the RFC Message-ID so two mailboxes share one key", () => {
    expect(buildMessageKey("<ABC@mail.gmail.com>", "a@lreproductions.com", "1")).toBe(
      buildMessageKey("<abc@mail.gmail.com>", "b@lreproductions.com", "2"),
    );
  });
  it("falls back to mailbox + Gmail id", () => {
    expect(buildMessageKey(null, "A@lreproductions.com", "99")).toBe(
      "gmail:a@lreproductions.com:99",
    );
  });
});

describe("stripQuotedReply", () => {
  it("cuts the quoted history under a reply", () => {
    const text = [
      "Sounds great, let's do Saturday.",
      "",
      "On Tue, Nov 3, 2026 at 9:00 AM Kallie <hello@lreproductions.com> wrote:",
      "> Does Saturday work?",
    ].join("\n");
    expect(stripQuotedReply(text)).toBe("Sounds great, let's do Saturday.");
  });
  it("removes > quoted lines", () => {
    expect(stripQuotedReply("Yes\n> old line\nThanks")).toBe("Yes\nThanks");
  });
});
