import { describe, expect, it } from "vitest";
import {
  CRM_CLAIM_STALE_MS,
  MAX_AUTO_CRM_ATTEMPTS,
  claimTakeoverSeconds,
  crmEndingFor,
  crmWriteInFlight,
  planCrmWrite,
  readClaim,
  refAfterFailure,
  refFromLogDetail,
  runCrmWrite,
  type CrmWriteDeps,
  type CrmWriter,
} from "./crm-claim-core";

const DONE = { client_id: "c-1", lead_id: "l-1" };
const PARTIAL = { client_id: "c-1", partial: "true" };

describe("claim policy", () => {
  it("lets the sweep and staff take over an abandoned claim, never the completion writer", () => {
    expect(claimTakeoverSeconds("completion")).toBeNull();
    expect(claimTakeoverSeconds("sweep")).toBe(CRM_CLAIM_STALE_MS / 1000);
    expect(claimTakeoverSeconds("staff")).toBe(CRM_CLAIM_STALE_MS / 1000);
    expect(CRM_CLAIM_STALE_MS).toBe(10 * 60 * 1000);
  });

  it("maps stages to the CRM summary ending", () => {
    expect(crmEndingFor("completed")).toBe("completed");
    expect(crmEndingFor("waitlisted")).toBe("waitlisted");
    expect(crmEndingFor("abandoned")).toBe("partial");
    expect(crmEndingFor("in_progress")).toBe("partial");
  });
});

describe("planCrmWrite", () => {
  const plan = (writer: CrmWriter, crmRef: unknown, loggedRefs: unknown[] = [], autoAttempts = 0) =>
    planCrmWrite({ writer, crmRef, loggedRefs, autoAttempts });

  it("does nothing when the record is already linked", () => {
    for (const writer of ["completion", "sweep", "staff"] as const) {
      expect(plan(writer, DONE)).toEqual({ step: "done", ref: DONE });
    }
  });

  it("re-links a record a logged write made instead of writing again, even past the attempt cap", () => {
    expect(plan("sweep", {}, [{}, DONE], MAX_AUTO_CRM_ATTEMPTS)).toEqual({ step: "relink", ref: DONE });
    expect(plan("staff", PARTIAL, [DONE])).toEqual({ step: "relink", ref: DONE });
    // A partial ref in the log is not a finished record.
    expect(plan("staff", {}, [PARTIAL]).step).toBe("claim");
  });

  it("stops automatic writers after the attempt cap, never staff", () => {
    expect(plan("completion", {}, [], MAX_AUTO_CRM_ATTEMPTS).step).toBe("gave_up");
    expect(plan("sweep", {}, [], MAX_AUTO_CRM_ATTEMPTS - 1).step).toBe("claim");
    expect(plan("staff", {}, [], 99).step).toBe("claim");
  });

  it("claims for an empty or half-done record", () => {
    expect(plan("completion", {}).step).toBe("claim");
    expect(plan("sweep", PARTIAL).step).toBe("claim");
    expect(plan("staff", null).step).toBe("claim");
  });
});

describe("claim helpers", () => {
  it("reads the claim function's answer", () => {
    expect(readClaim(null)).toBeNull();
    expect(readClaim({})).toBeNull();
    expect(readClaim({ claimed_at: "" })).toBeNull();
    expect(readClaim({ claimed_at: "2026-11-04T20:00:00.123456+00:00", crm_ref: PARTIAL })).toEqual({
      token: "2026-11-04T20:00:00.123456+00:00",
      crmRef: PARTIAL,
    });
    expect(readClaim([{ claimed_at: "t", crm_ref: {} }])).toEqual({ token: "t", crmRef: {} });
  });

  it("knows when a write is probably running", () => {
    const now = new Date("2026-11-04T20:10:00Z");
    const recent = new Date(now.getTime() - 60_000).toISOString();
    const old = new Date(now.getTime() - CRM_CLAIM_STALE_MS - 1).toISOString();
    expect(crmWriteInFlight({ crmRef: {}, claimedAt: recent }, now)).toBe(true);
    expect(crmWriteInFlight({ crmRef: PARTIAL, claimedAt: recent }, now)).toBe(true);
    expect(crmWriteInFlight({ crmRef: {}, claimedAt: old }, now)).toBe(false);
    expect(crmWriteInFlight({ crmRef: DONE, claimedAt: recent }, now)).toBe(false);
    expect(crmWriteInFlight({ crmRef: {}, claimedAt: null }, now)).toBe(false);
  });

  it("keeps a half-done write as a partial ref, and reads logged refs in both shapes", () => {
    expect(refAfterFailure({}, undefined)).toBeNull();
    expect(refAfterFailure({}, {})).toBeNull();
    expect(refAfterFailure({}, { client_id: "c-9" })).toEqual({ client_id: "c-9", partial: "true" });
    expect(refFromLogDetail({ ref: DONE })).toEqual(DONE);
    expect(refFromLogDetail({ by: "admin", crm_ref: DONE })).toEqual(DONE);
    expect(refFromLogDetail(null)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// runCrmWrite against a fake database whose claim is atomic like inquiry_crm_claim
// ---------------------------------------------------------------------------

interface FakeDb {
  crmRef: Record<string, string>;
  claimedAt: number | null;
  token: string | null;
  clock: number;
  logs: { kind: string; status: "sent" | "failed"; detail: Record<string, unknown> }[];
  recordCalls: { writer: CrmWriter; crmRef: Record<string, string> }[];
}

function fakeDb(init: Partial<Pick<FakeDb, "crmRef" | "claimedAt">> = {}): FakeDb {
  return {
    crmRef: init.crmRef ?? {},
    claimedAt: init.claimedAt ?? null,
    token: init.claimedAt != null ? new Date(init.claimedAt).toISOString() : null,
    clock: Date.parse("2026-11-04T20:00:00Z"),
    logs: [],
    recordCalls: [],
  };
}

/** Lets the other writers run (the await points of real I/O). */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function depsFor(
  db: FakeDb,
  writer: CrmWriter,
  opts: { failWith?: Error & { partialRef?: Record<string, string> }; linkFails?: boolean } = {},
): CrmWriteDeps {
  return {
    loggedRefs: async () => {
      await tick();
      return db.logs.filter((l) => l.status === "sent").map((l) => refFromLogDetail(l.detail)).reverse();
    },
    autoAttempts: async () => db.logs.filter((l) => l.kind === "crm_record").length,
    // One synchronous step after the await: the whole check-and-set is atomic, like the SQL update.
    claim: async (takeoverSeconds) => {
      await tick();
      const noRecord = Object.keys(db.crmRef).length === 0 || db.crmRef.partial === "true";
      const free =
        db.claimedAt === null || (takeoverSeconds !== null && db.claimedAt < db.clock - takeoverSeconds * 1000);
      if (!noRecord || !free) return null;
      db.clock += 1;
      db.claimedAt = db.clock;
      db.token = new Date(db.clock).toISOString();
      return { claimed_at: db.token, crm_ref: { ...db.crmRef } };
    },
    currentRef: async () => ({ ...db.crmRef }),
    record: async (crmRef) => {
      db.recordCalls.push({ writer, crmRef });
      await tick();
      if (opts.failWith) throw opts.failWith;
      return { client_id: crmRef.client_id ?? `c-${db.recordCalls.length}`, lead_id: `l-${db.recordCalls.length}` };
    },
    saveRef: async (ref) => {
      await tick();
      if (opts.linkFails) return false;
      db.crmRef = ref;
      return true;
    },
    release: async (token, ref) => {
      await tick();
      if (db.token !== token) return false;
      db.claimedAt = null;
      db.token = null;
      if (ref) db.crmRef = ref;
      return true;
    },
    log: async (status, detail) => {
      db.logs.push({ kind: writer === "staff" ? "crm_manual" : "crm_record", status, detail });
    },
  };
}

describe("runCrmWrite: one Leads card per inquiry", () => {
  it("completion, the sweep and two staff clicks racing create exactly one record", async () => {
    const db = fakeDb();
    const writers: CrmWriter[] = ["completion", "sweep", "staff", "staff"];
    const results = await Promise.all(writers.map((w) => runCrmWrite(w, {}, depsFor(db, w))));
    expect(db.recordCalls).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "created")).toHaveLength(1);
    for (const r of results) expect(["created", "busy", "done"]).toContain(r.outcome);
    expect(db.crmRef).toEqual({ client_id: "c-1", lead_id: "l-1" });
  });

  it("a writer that arrives after the record exists only reports it (Already in Leads)", async () => {
    const db = fakeDb();
    await runCrmWrite("completion", {}, depsFor(db, "completion"));
    // The drawer loaded the submission before that write finished, so it still has an empty crm_ref.
    const late = await runCrmWrite("staff", {}, depsFor(db, "staff"));
    expect(["done", "relinked"]).toContain(late.outcome);
    expect(late.ref).toEqual({ client_id: "c-1", lead_id: "l-1" });
    expect(db.recordCalls).toHaveLength(1);
  });

  it("a failed write releases the claim, keeps the client, and the retry reuses it", async () => {
    const db = fakeDb();
    const failure = Object.assign(new Error("lead insert: timeout"), { partialRef: { client_id: "c-7" } });
    const first = await runCrmWrite("completion", {}, depsFor(db, "completion", { failWith: failure }));
    expect(first).toMatchObject({ outcome: "failed", error: "lead insert: timeout" });
    expect(db.claimedAt).toBeNull();
    expect(db.crmRef).toEqual({ client_id: "c-7", partial: "true" });
    expect(db.logs.at(-1)).toMatchObject({ kind: "crm_record", status: "failed" });

    const retry = await runCrmWrite("sweep", db.crmRef, depsFor(db, "sweep"));
    expect(retry).toEqual({ outcome: "created", ref: { client_id: "c-7", lead_id: "l-2" } });
    expect(db.recordCalls[1].crmRef).toEqual({ client_id: "c-7", partial: "true" });
  });

  it("re-links a record whose link was lost, and never writes it again", async () => {
    const db = fakeDb();
    const first = await runCrmWrite("completion", {}, depsFor(db, "completion", { linkFails: true }));
    expect(first.outcome).toBe("created");
    expect(db.crmRef).toEqual({});
    expect(db.claimedAt).not.toBeNull(); // kept: the record exists

    for (const writer of ["sweep", "staff"] as const) {
      const again = await runCrmWrite(writer, {}, depsFor(db, writer));
      expect(again).toEqual({ outcome: "relinked", ref: { client_id: "c-1", lead_id: "l-1" } });
    }
    expect(db.recordCalls).toHaveLength(1);
    expect(db.crmRef).toEqual({ client_id: "c-1", lead_id: "l-1" });
  });

  it("waits out a live claim, and takes over an abandoned one (sweep and staff, not completion)", async () => {
    const start = Date.parse("2026-11-04T20:00:00Z");
    const live = fakeDb({ claimedAt: start - 60_000 });
    for (const writer of ["completion", "sweep", "staff"] as const) {
      expect((await runCrmWrite(writer, {}, depsFor(live, writer))).outcome).toBe("busy");
    }
    expect(live.recordCalls).toHaveLength(0);

    const abandoned = fakeDb({ claimedAt: start - CRM_CLAIM_STALE_MS - 1000 });
    expect((await runCrmWrite("completion", {}, depsFor(abandoned, "completion"))).outcome).toBe("busy");
    expect((await runCrmWrite("staff", {}, depsFor(abandoned, "staff"))).outcome).toBe("created");
    expect(abandoned.recordCalls).toHaveLength(1);
  });

  it("gives automatic writers three logged attempts, then leaves it to staff", async () => {
    const db = fakeDb();
    const failure = new Error("clients insert: offline");
    for (let i = 0; i < MAX_AUTO_CRM_ATTEMPTS; i += 1) {
      expect((await runCrmWrite("sweep", db.crmRef, depsFor(db, "sweep", { failWith: failure }))).outcome).toBe("failed");
    }
    expect((await runCrmWrite("sweep", db.crmRef, depsFor(db, "sweep"))).outcome).toBe("gave_up");
    expect((await runCrmWrite("staff", db.crmRef, depsFor(db, "staff"))).outcome).toBe("created");
    expect(db.recordCalls).toHaveLength(MAX_AUTO_CRM_ATTEMPTS + 1);
  });

  it("never claims for a submission that is already linked", async () => {
    const db = fakeDb({ crmRef: DONE });
    const deps = depsFor(db, "staff");
    let claimed = false;
    const result = await runCrmWrite("staff", DONE, { ...deps, claim: async (s) => ((claimed = true), deps.claim(s)) });
    expect(result).toEqual({ outcome: "done", ref: DONE });
    expect(claimed).toBe(false);
  });
});
