import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_MS, clearSession, readSession, sessionKey, writeSession, type StoredSession } from "./session";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  throwOnSet = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.throwOnSet) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
}

const NOW = 1_800_000_000_000;
const EXPECT = { formId: "form-1", versionId: "ver-3", stepCount: 5 };

function session(over: Partial<StoredSession> = {}): StoredSession {
  return {
    v: 1,
    formId: "form-1",
    versionId: "ver-3",
    submission: { id: "sub-1", token: "tok-1" },
    stepIndex: 2,
    answers: { full_name: "Dana Cole", event_date: "2027-05-15" },
    waitlist: false,
    qualify: {
      "s-check": {
        key: '["2027-05-15","Casa Monica"]',
        result: { qualification: { date: { result: "available", checkedFor: "2027-05-15", message: "Open", checkedAt: "x" } }, celebrate: true, urgency: null },
      },
    },
    ending: null,
    savedAt: NOW - 1000,
    ...over,
  };
}

describe("session resume", () => {
  it("round-trips a session for the same form version", () => {
    const s = new MemoryStorage();
    writeSession(s, "check-your-date", session());
    const back = readSession(s, "check-your-date", EXPECT, NOW);
    expect(back?.stepIndex).toBe(2);
    expect(back?.submission).toEqual({ id: "sub-1", token: "tok-1" });
    expect(back?.qualify["s-check"].result.celebrate).toBe(true);
  });

  it("ignores another version, another form, stale or future records", () => {
    const s = new MemoryStorage();
    writeSession(s, "f", session({ versionId: "ver-2" }));
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
    writeSession(s, "f", session({ formId: "other" }));
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
    writeSession(s, "f", session({ savedAt: NOW - SESSION_MAX_AGE_MS - 1 }));
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
    writeSession(s, "f", session({ savedAt: NOW + 10 * 60_000 }));
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
  });

  it("rejects out-of-range steps and malformed JSON", () => {
    const s = new MemoryStorage();
    writeSession(s, "f", session({ stepIndex: 5 }));
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
    s.setItem(sessionKey("f"), "{not json");
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
    s.setItem(sessionKey("f"), JSON.stringify({ v: 2 }));
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
  });

  it("puts a visitor without a submission back on the first step", () => {
    const s = new MemoryStorage();
    writeSession(s, "f", session({ submission: null, stepIndex: 3 }));
    expect(readSession(s, "f", EXPECT, NOW)?.stepIndex).toBe(0);
  });

  it("drops malformed cache entries and endings instead of trusting them", () => {
    const s = new MemoryStorage();
    const raw = {
      ...session(),
      qualify: { a: { key: 1, result: {} }, b: { key: "k", result: { qualification: {}, celebrate: "yes" } } },
      ending: { kind: "spam", title: "x", message: "y" },
    };
    s.setItem(sessionKey("f"), JSON.stringify(raw));
    const back = readSession(s, "f", EXPECT, NOW);
    expect(back?.qualify).toEqual({});
    expect(back?.ending).toBeNull();
  });

  it("survives unavailable storage and quota errors", () => {
    expect(readSession(null, "f", EXPECT, NOW)).toBeNull();
    const s = new MemoryStorage();
    s.throwOnSet = true;
    expect(() => writeSession(s, "f", session())).not.toThrow();
    expect(() => clearSession(null, "f")).not.toThrow();
  });

  it("clears the record", () => {
    const s = new MemoryStorage();
    writeSession(s, "f", session());
    clearSession(s, "f");
    expect(readSession(s, "f", EXPECT, NOW)).toBeNull();
  });
});
