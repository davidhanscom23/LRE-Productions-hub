// @vitest-environment node
/**
 * The LRE adapter against a scripted Supabase fake: the Pipeline client match (fill blanks only,
 * unique-email race), the Inquiry project and its history row, partial retries, availability
 * inputs, staff alerts, email, and which profile each auth check reads.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const auth = vi.hoisted(() => ({ getCurrentProfile: vi.fn(), getRealProfile: vi.fn() }));
vi.mock("@/lib/auth/profile", () => auth);
const mail = vi.hoisted(() => ({ sendEmailDetailed: vi.fn() }));
vi.mock("@/lib/email/send", () => mail);
const bell = vi.hoisted(() => ({ insertNotifications: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => bell);

import type { CrmSummary, SubmissionRow } from "../types";
import { CrmWriteError, hubAdapter } from "./adapter";

// ---------------------------------------------------------------------------
// A tiny PostgREST-shaped fake: every awaited query becomes one Op, answered by `reply`.
// ---------------------------------------------------------------------------

type Filter = [op: string, column: string, value: unknown];
interface Op {
  table: string;
  action: "select" | "insert" | "update";
  payload?: unknown;
  filters: Filter[];
}
type Reply = { data?: unknown; error?: { message: string; code?: string } | null };

function fakeSupabase(reply: (op: Op) => Reply) {
  const ops: Op[] = [];
  const sb = {
    from(table: string) {
      const op: Op = { table, action: "select", filters: [] };
      const chain: Record<string, unknown> = {};
      const filter = (name: string) => (column: string, value: unknown) => {
        op.filters.push([name, column, value]);
        return chain;
      };
      Object.assign(chain, {
        select: () => chain,
        insert: (payload: unknown) => {
          op.action = "insert";
          op.payload = payload;
          return chain;
        },
        update: (payload: unknown) => {
          op.action = "update";
          op.payload = payload;
          return chain;
        },
        eq: filter("eq"),
        neq: filter("neq"),
        ilike: filter("ilike"),
        overlaps: filter("overlaps"),
        in: filter("in"),
        lte: filter("lte"),
        gte: filter("gte"),
        limit: () => chain,
        order: () => chain,
        single: () => chain,
        maybeSingle: () => chain,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          ops.push(op);
          const r = reply(op);
          return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve, reject);
        },
      });
      return chain;
    },
  };
  return { sb: sb as unknown as SupabaseClient, ops };
}

const has = (op: Op, name: string, column: string, value?: unknown) =>
  op.filters.some(([n, c, v]) => n === name && c === column && (value === undefined || v === value));

function summary(over: Partial<CrmSummary> = {}): CrmSummary {
  return {
    name: "Jane Smith",
    email: "jane@acme.com",
    phone: "904-555-0100",
    company: "Acme Corp",
    eventType: "Corporate Event",
    eventDate: "2027-05-15",
    eventTimeStart: null,
    eventTimeEnd: null,
    eventLocation: "Ponte Vedra",
    guestCount: null,
    guestLabel: "150 - 300",
    services: [],
    budgetLabel: "$25,000 - $50,000",
    budgetLow: 25000,
    referral: null,
    contactPreference: null,
    notes: null,
    scoreLabel: "high",
    ending: "completed",
    ...over,
  };
}

function submission(crmRef: Record<string, string> = {}): SubmissionRow {
  return {
    id: "sub-1",
    form_id: "form-1",
    version_id: "ver-1",
    stage: "completed",
    current_step: 5,
    total_steps: 6,
    answers: {},
    contact_name: "Jane Smith",
    contact_email: "jane@acme.com",
    contact_phone: "904-555-0100",
    event_date: "2027-05-15",
    event_location: "Ponte Vedra",
    guest_count: null,
    qualification: {
      date: { result: "open", checkedFor: "2027-05-15", message: "Your date looks open.", checkedAt: "2026-11-05T12:00:00Z" },
    },
    score: 80,
    score_label: "high",
    attribution: {},
    crm_ref: crmRef,
    spam_reason: null,
    started_at: "2026-11-05T12:00:00Z",
    last_activity_at: "2026-11-05T12:05:00Z",
    completed_at: "2026-11-05T12:05:00Z",
    abandoned_at: null,
    abandon_notified_at: null,
    staff_notified_at: null,
    confirmation_sent_at: null,
    created_at: "2026-11-05T12:00:00Z",
    updated_at: "2026-11-05T12:05:00Z",
  };
}

const FORM = { id: "form-1", name: "Get a Quote", slug: "get-a-quote" };
const LINES = ["Full name: Jane Smith", "Area: Ponte Vedra"];

function record(sb: SupabaseClient, crmRef: Record<string, string> = {}, s: CrmSummary = summary()) {
  return hubAdapter.recordInquiry(sb, { submission: submission(crmRef), form: FORM, summary: s, lines: LINES });
}

/** Happy-path replies; `over` replaces one table/action answer. */
function replies(over: Partial<Record<string, (op: Op) => Reply>> = {}) {
  return (op: Op): Reply => {
    const custom = over[`${op.table}:${op.action}`];
    if (custom) return custom(op);
    if (op.table === "pipeline_clients" && op.action === "select") return { data: null };
    if (op.table === "pipeline_clients" && op.action === "insert") return { data: { id: "client-new" } };
    if (op.table === "pipeline_projects" && op.action === "insert") return { data: { id: "project-1" } };
    return { data: null };
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  auth.getCurrentProfile.mockReset();
  auth.getRealProfile.mockReset();
  mail.sendEmailDetailed.mockReset();
  bell.insertNotifications.mockReset();
});

describe("recordInquiry", () => {
  it("creates a web_form client, an Inquiry project and its history row", async () => {
    const { sb, ops } = fakeSupabase(replies());
    const ref = await record(sb);
    expect(ref).toEqual({ client_id: "client-new", project_id: "project-1" });

    const lookup = ops[0];
    expect(lookup).toMatchObject({ table: "pipeline_clients", action: "select" });
    expect(has(lookup, "eq", "email", "jane@acme.com")).toBe(true);
    expect(lookup.filters.some(([n]) => n === "ilike")).toBe(false);

    const client = ops.find((o) => o.table === "pipeline_clients" && o.action === "insert");
    expect(client?.payload).toMatchObject({
      full_name: "Jane Smith",
      email: "jane@acme.com",
      phone: "904-555-0100",
      source_event: "web_form",
      raw: { submission_id: "sub-1" },
    });

    const project = ops.find((o) => o.table === "pipeline_projects" && o.action === "insert");
    expect(project?.payload).toMatchObject({
      name: "Jane Smith - Corporate Event",
      stage: "Inquiry",
      client_id: "client-new",
      project_type: "Corporate Event",
      project_date: "2027-05-15",
      budget: 25000,
      location: "Ponte Vedra",
      source_event: "web_form",
      raw: { form_slug: "get-a-quote", submission_id: "sub-1" },
    });
    const details = (project?.payload as { details: string }).details;
    expect(details.split("\n")[0]).toBe("Website form: Get a Quote");
    expect(details).toContain("Fit: high (80).");
    expect(details).toContain("Area: Ponte Vedra");
    expect(details.length).toBeLessThanOrEqual(3500);

    const history = ops.find((o) => o.table === "pipeline_project_stage_events");
    expect(history?.payload).toEqual({ project_id: "project-1", from_stage: "", to_stage: "Inquiry", changed_by: null });
  });

  it("reuses an existing client by exact email and fills only its blank phone", async () => {
    const { sb, ops } = fakeSupabase(
      replies({
        "pipeline_clients:select": () => ({ data: { id: "client-old", full_name: "J. Smith", phone: "", source_event: "web_form" } }),
      }),
    );
    const ref = await record(sb);
    expect(ref).toEqual({ client_id: "client-old", project_id: "project-1" });
    expect(ops.some((o) => o.table === "pipeline_clients" && o.action === "insert")).toBe(false);
    const fill = ops.find((o) => o.table === "pipeline_clients" && o.action === "update");
    expect(fill?.payload).toMatchObject({ phone: "904-555-0100" });
    expect(fill?.payload).not.toHaveProperty("full_name");
    expect(has(fill as Op, "eq", "id", "client-old")).toBe(true);
    // Guarded on the value just read, so a phone saved a moment ago is never replaced.
    expect(has(fill as Op, "eq", "phone", "")).toBe(true);
  });

  it("never writes the visitor's phone onto a client the website did not create", async () => {
    // A Pipeline-synced client with a blank phone: the email is not verified, so nothing is planted.
    const { sb, ops } = fakeSupabase(
      replies({
        "pipeline_clients:select": () => ({ data: { id: "client-hb", full_name: "", phone: "", source_event: "project.upsert" } }),
      }),
    );
    const ref = await record(sb);
    expect(ref).toEqual({ client_id: "client-hb", project_id: "project-1" });
    expect(ops.some((o) => o.table === "pipeline_clients" && o.action === "update")).toBe(false);
  });

  it("reuses the project a writer that died after its insert left behind (found by submission id)", async () => {
    const { sb, ops } = fakeSupabase(
      replies({
        "pipeline_projects:select": (op) =>
          has(op, "eq", "raw->>submission_id", "sub-1") && has(op, "eq", "source_event", "web_form")
            ? { data: { id: "project-earlier", client_id: "client-new" } }
            : { data: null },
      }),
    );
    expect(await record(sb, { client_id: "client-new", partial: "true" })).toEqual({
      client_id: "client-new",
      project_id: "project-earlier",
    });
    expect(ops.some((o) => o.table === "pipeline_projects" && o.action === "insert")).toBe(false);
  });

  it("never updates a client that has a name and phone already", async () => {
    const { sb, ops } = fakeSupabase(
      replies({ "pipeline_clients:select": () => ({ data: { id: "client-old", full_name: "J. Smith", phone: "904-111-2222" } }) }),
    );
    await record(sb);
    expect(ops.some((o) => o.table === "pipeline_clients" && o.action === "update")).toBe(false);
  });

  it("uses the client another write just saved when the insert hits the unique email (23505)", async () => {
    let lookups = 0;
    const { sb, ops } = fakeSupabase(
      replies({
        "pipeline_clients:select": (op) => {
          lookups += 1;
          // First exact lookup misses; the retry finds the row by case-insensitive exact match.
          return has(op, "ilike", "email") ? { data: { id: "client-race", full_name: "Jane", phone: "" } } : { data: null };
        },
        "pipeline_clients:insert": () => ({
          error: { code: "23505", message: 'duplicate key value violates unique constraint "pipeline_clients_email_uidx"' },
        }),
      }),
    );
    const ref = await record(sb);
    expect(ref).toEqual({ client_id: "client-race", project_id: "project-1" });
    expect(lookups).toBe(3);
    const loose = ops.find((o) => has(o, "ilike", "email"));
    expect(has(loose as Op, "ilike", "email", "jane@acme.com")).toBe(true);
  });

  it("fails with nothing made when the unique email row cannot be found again", async () => {
    const { sb } = fakeSupabase(
      replies({ "pipeline_clients:insert": () => ({ error: { code: "23505", message: "duplicate key" } }) }),
    );
    const err = await record(sb).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CrmWriteError);
    expect((err as CrmWriteError).message).toContain("client insert");
    expect((err as CrmWriteError).partialRef).toEqual({});
  });

  it("keeps the client as a partial ref when the project insert fails, and the retry reuses it", async () => {
    const failing = fakeSupabase(replies({ "pipeline_projects:insert": () => ({ error: { message: "permission denied" } }) }));
    const err = await record(failing.sb).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CrmWriteError);
    expect((err as CrmWriteError).partialRef).toEqual({ client_id: "client-new" });

    const retry = fakeSupabase(replies());
    const ref = await record(retry.sb, { client_id: "client-new", partial: "true" });
    expect(ref).toEqual({ client_id: "client-new", project_id: "project-1" });
    expect(retry.ops.some((o) => o.table === "pipeline_clients")).toBe(false);
    const project = retry.ops.find((o) => o.table === "pipeline_projects" && o.action === "insert");
    expect((project?.payload as { client_id: string }).client_id).toBe("client-new");
  });

  it("never makes a second project once crm_ref holds one", async () => {
    const { sb, ops } = fakeSupabase(replies());
    expect(await record(sb, { client_id: "c1", project_id: "p1" })).toEqual({ client_id: "c1", project_id: "p1" });
    expect(await record(sb, { client_id: "c1", project_id: "p1", partial: "true" })).toEqual({ client_id: "c1", project_id: "p1" });
    expect(ops).toHaveLength(0);
  });

  it("still counts the write when only the history row fails (the project is on the board)", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sb } = fakeSupabase(
      replies({ "pipeline_project_stage_events:insert": () => ({ error: { message: "stage events missing" } }) }),
    );
    expect(await record(sb)).toEqual({ client_id: "client-new", project_id: "project-1" });
    expect(logged).toHaveBeenCalled();
  });

  it("creates a new client for a phone-only inquiry without looking one up", async () => {
    const { sb, ops } = fakeSupabase(replies());
    await record(sb, {}, summary({ email: null, name: "Jane Smith" }));
    expect(ops[0]).toMatchObject({ table: "pipeline_clients", action: "insert" });
    expect((ops[0].payload as { email: string }).email).toBe("");
  });

  it("surfaces a lookup error as a CRM write error", async () => {
    const { sb } = fakeSupabase(replies({ "pipeline_clients:select": () => ({ error: { message: "timeout" } }) }));
    await expect(record(sb)).rejects.toThrow("client lookup: timeout");
  });
});

describe("staffRecordHref", () => {
  it("opens the project page once the write is complete", () => {
    expect(hubAdapter.staffRecordHref({ client_id: "c1", project_id: "p 1" })).toBe("/pipeline/projects/p%201");
    expect(hubAdapter.staffRecordHref({ client_id: "c1", partial: "true" })).toBeNull();
    expect(hubAdapter.staffRecordHref({})).toBeNull();
  });
});

describe("availability inputs", () => {
  it("bookingsOn counts committed projects on that date", async () => {
    const { sb, ops } = fakeSupabase(() => ({
      data: [
        { id: "a", stage: "_BOOKED_", booked_at: null, project_date: "2027-05-15" },
        { id: "b", stage: "Inquiry", booked_at: null, project_date: "2027-05-15" },
        { id: "c", stage: "Lost", booked_at: "2027-01-01T00:00:00Z", project_date: "2027-05-15" },
        { id: "d", stage: "_RETAINER_PAID_", booked_at: null, project_date: "2027-05-15" },
      ],
    }));
    expect(await hubAdapter.bookingsOn(sb, "2027-05-15")).toBe(2);
    expect(ops[0].table).toBe("pipeline_projects");
    expect(has(ops[0], "eq", "project_date", "2027-05-15")).toBe(true);
  });

  it("capacityOn is null for the default (no capacity source) and honors a fixed number or staff", async () => {
    const { sb, ops } = fakeSupabase((op) =>
      op.table === "profiles" ? { data: [{ id: "u1" }, { id: "u2" }, { id: "u3" }] } : { data: [{ user_id: "u2" }] },
    );
    expect(await hubAdapter.capacityOn(sb, "2027-05-15", { source: "none", departments: [], fixed: null })).toBeNull();
    expect(await hubAdapter.capacityOn(sb, "2027-05-15", { source: "fixed", fixed: 3 })).toBe(3);
    expect(await hubAdapter.capacityOn(sb, "2027-05-15", { source: "fixed", fixed: 0 })).toBeNull();
    expect(ops).toHaveLength(0);
    expect(await hubAdapter.capacityOn(sb, "2027-05-15", { source: "staff", departments: ["Audiovisual"] })).toBe(2);
    expect(has(ops[0], "overlaps", "departments")).toBe(true);
    expect(has(ops[1], "eq", "status", "approved")).toBe(true);
  });
});

describe("notifyStaff", () => {
  it("alerts every active admin through the hub helper, asking it to throw on a failed insert", async () => {
    const { sb, ops } = fakeSupabase(() => ({ data: [{ id: "a1" }, { id: "a2" }] }));
    await hubAdapter.notifyStaff(sb, { kind: "web_inquiry", title: "New website inquiry", body: "Jane", href: "/pipeline/projects/p1" });
    expect(has(ops[0], "eq", "role", "admin")).toBe(true);
    expect(has(ops[0], "eq", "is_active", true)).toBe(true);
    expect(bell.insertNotifications).toHaveBeenCalledWith(
      sb,
      [
        { userId: "a1", kind: "web_inquiry", title: "New website inquiry", body: "Jane", href: "/pipeline/projects/p1" },
        { userId: "a2", kind: "web_inquiry", title: "New website inquiry", body: "Jane", href: "/pipeline/projects/p1" },
      ],
      { throwOnError: true },
    );
  });

  it("fails loudly with no admins, so the sweep retries", async () => {
    const { sb } = fakeSupabase(() => ({ data: [] }));
    await expect(
      hubAdapter.notifyStaff(sb, { kind: "web_inquiry_unfinished", title: "t", body: "b", href: "/x" }),
    ).rejects.toThrow("No active admins");
    expect(bell.insertNotifications).not.toHaveBeenCalled();
  });
});

describe("sendEmail", () => {
  it("passes html and Reply-To to the hub mailer", async () => {
    mail.sendEmailDetailed.mockResolvedValue({ ok: true });
    const out = await hubAdapter.sendEmail({
      to: ["jane@acme.com"],
      subject: "We received your request",
      text: "t",
      html: "<p>t</p>",
      replyTo: "hello@lreproductions.com",
    });
    expect(out).toEqual({ ok: true, skipped: undefined, error: undefined });
    expect(mail.sendEmailDetailed).toHaveBeenCalledWith({
      to: ["jane@acme.com"],
      subject: "We received your request",
      text: "t",
      html: "<p>t</p>",
      replyTo: "hello@lreproductions.com",
    });
  });
});

describe("auth checks", () => {
  const admin = { id: "a1", role: "admin", full_name: "David Hanscom", email: "hello@lreproductions.com", is_active: true };

  it("currentAdmin reads the REAL profile, so an admin in View as staff still counts", async () => {
    auth.getRealProfile.mockResolvedValue(admin);
    auth.getCurrentProfile.mockResolvedValue({ ...admin, role: "staff" });
    expect(await hubAdapter.currentAdmin()).toEqual({ id: "a1", name: "David Hanscom" });
    auth.getRealProfile.mockResolvedValue({ ...admin, is_active: false });
    expect(await hubAdapter.currentAdmin()).toBeNull();
    auth.getRealProfile.mockResolvedValue({ ...admin, role: "trainer" });
    expect(await hubAdapter.currentAdmin()).toBeNull();
    auth.getRealProfile.mockResolvedValue(null);
    expect(await hubAdapter.currentAdmin()).toBeNull();
  });

  it("viewerRole follows View as staff for page gates", async () => {
    auth.getCurrentProfile.mockResolvedValue({ ...admin, role: "staff" });
    expect(await hubAdapter.viewerRole()).toBe("staff");
    auth.getCurrentProfile.mockResolvedValue(admin);
    expect(await hubAdapter.viewerRole()).toBe("admin");
    auth.getCurrentProfile.mockResolvedValue(null);
    expect(await hubAdapter.viewerRole()).toBeNull();
  });
});

describe("hub identity", () => {
  it("is the LRE hub with both brands and an absolute origin", () => {
    expect(hubAdapter.hubKey).toBe("lre");
    expect(hubAdapter.brands.map((b) => b.key)).toEqual(["lre-productions", "lre-av"]);
    expect(hubAdapter.defaultBrand).toBe("lre-productions");
    expect(hubAdapter.publicOrigin()).toMatch(/^https?:\/\/[^/]+(\/.*[^/])?$/);
  });
});
