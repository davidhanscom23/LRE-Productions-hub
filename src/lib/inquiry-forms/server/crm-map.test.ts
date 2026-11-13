import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildCrmSummary, formatAnswerLines } from "../answers";
import type { Answers, CrmSummary } from "../types";
import {
  buildClientInsert,
  buildProjectDetails,
  buildProjectInsert,
  buildStageEventInsert,
  capacityFromPeople,
  clientBlankFills,
  countCommittedOn,
  escapeIlike,
  INQUIRY_STAGE,
  isCommittedProject,
  personName,
  PROJECT_DETAILS_MAX,
  projectName,
  toBudget,
  WEB_FORM_SOURCE,
  type ProjectDayRow,
} from "./crm-map";
import { STARTER_FORMS } from "./presets";

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
    services: ["Audio & Visuals", "Planning"],
    budgetLabel: "$25,000 - $50,000",
    budgetLow: 25000,
    referral: null,
    contactPreference: "Email",
    notes: "Annual sales kickoff for 200 people, two days, keynote plus breakouts.",
    scoreLabel: "high",
    ending: "completed",
    ...over,
  };
}

describe("personName", () => {
  it("is the visitor's own name, never the company, email or phone fallback", () => {
    expect(personName(summary())).toBe("Jane Smith");
    expect(personName(summary({ name: "Acme Corp" }))).toBeNull();
    expect(personName(summary({ name: "jane@acme.com" }))).toBeNull();
    expect(personName(summary({ name: "904-555-0100" }))).toBeNull();
    expect(personName(summary({ name: "Website inquiry" }))).toBeNull();
    expect(personName(summary({ name: "  " }))).toBeNull();
  });
});

describe("buildClientInsert", () => {
  it("makes a web_form client with the lowercased email and the submission id", () => {
    expect(buildClientInsert(summary({ email: "Jane@Acme.COM " }), "sub-1")).toEqual({
      full_name: "Jane Smith",
      email: "jane@acme.com",
      phone: "904-555-0100",
      address: "",
      source_event: WEB_FORM_SOURCE,
      raw: { submission_id: "sub-1" },
    });
  });

  it("always satisfies pipeline_clients_name_or_email (full_name or email non-blank)", () => {
    const cases = [summary(), summary({ email: null }), summary({ name: "", email: null, phone: "904-555-0100" })];
    for (const s of cases) {
      const row = buildClientInsert(s, "sub-1");
      expect(row.full_name.trim().length > 0 || row.email.trim().length > 0).toBe(true);
      // NOT NULL text columns get "" rather than null.
      for (const v of [row.full_name, row.email, row.phone, row.address]) expect(typeof v).toBe("string");
    }
  });
});

describe("clientBlankFills (an existing client is never overwritten)", () => {
  it("never writes onto a client the website did not create (the visitor's email is not verified)", () => {
    // A Pipeline-synced client with a blank phone: a stranger who knows the email must not plant theirs.
    expect(clientBlankFills({ id: "c1", full_name: "", phone: "", source_event: "pipeline" }, summary())).toBeNull();
    expect(clientBlankFills({ id: "c1", full_name: "", phone: "", source_event: null }, summary())).toBeNull();
  });

  it("fills only a blank name or phone", () => {
    expect(clientBlankFills({ id: "c1", full_name: "", phone: "", source_event: "web_form" }, summary())).toEqual({
      full_name: "Jane Smith",
      phone: "904-555-0100",
    });
    expect(clientBlankFills({ id: "c1", full_name: "  ", phone: "904-111-2222", source_event: "web_form" }, summary())).toEqual({ full_name: "Jane Smith" });
    expect(clientBlankFills({ id: "c1", full_name: "J. Smith", phone: "", source_event: "web_form" }, summary())).toEqual({ phone: "904-555-0100" });
    expect(clientBlankFills({ id: "c1", full_name: "J. Smith", phone: "904-111-2222", source_event: "web_form" }, summary())).toBeNull();
  });

  it("never writes a company or email into a person's name", () => {
    expect(clientBlankFills({ id: "c1", full_name: "", phone: "904-1", source_event: "web_form" }, summary({ name: "Acme Corp" }))).toBeNull();
    expect(clientBlankFills({ id: "c1", full_name: "", phone: "904-1", source_event: "web_form" }, summary({ name: "jane@acme.com" }))).toBeNull();
  });
});

describe("projectName", () => {
  it("is '<Name> - <Event type>' and never blank", () => {
    expect(projectName(summary())).toBe("Jane Smith - Corporate Event");
    expect(projectName(summary({ eventType: null }))).toBe("Jane Smith - Website inquiry");
    expect(projectName(summary({ name: "Website inquiry", eventType: null }))).toBe("Website inquiry");
    expect(projectName(summary({ name: "", eventType: "Gala" }))).toBe("Website inquiry - Gala");
    expect(projectName(summary({ name: "x".repeat(400), eventType: "Gala" })).length).toBeLessThanOrEqual(300);
  });
});

describe("toBudget (numeric(12,2))", () => {
  it("keeps a real amount and drops anything the column cannot hold", () => {
    expect(toBudget(25000)).toBe(25000);
    expect(toBudget(1234.567)).toBe(1234.57);
    expect(toBudget(0)).toBe(0);
    expect(toBudget(null)).toBeNull();
    expect(toBudget(undefined)).toBeNull();
    expect(toBudget(-5)).toBeNull();
    expect(toBudget(Number.NaN)).toBeNull();
    expect(toBudget(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toBudget(1e11)).toBeNull();
    expect(toBudget(9_999_999_999.99)).toBe(9_999_999_999.99);
  });
});

describe("buildProjectDetails", () => {
  it("names the form, then the qualification line, then every answer", () => {
    expect(
      buildProjectDetails({
        formName: "Get a Quote",
        ending: "completed",
        summaryLine: "Fit: high (80). Date open. Budget: $25,000 - $50,000.",
        lines: ["Full name: Jane Smith", "Area: Ponte Vedra"],
      }),
    ).toBe(
      "Website form: Get a Quote\nFit: high (80). Date open. Budget: $25,000 - $50,000.\n\nFull name: Jane Smith\nArea: Ponte Vedra",
    );
  });

  it("notes a waitlist or an unfinished inquiry added by staff", () => {
    const base = { formName: "Request AV", summaryLine: "Not qualified automatically.", lines: [] };
    expect(buildProjectDetails({ ...base, ending: "waitlisted" }).split("\n")[0]).toBe(
      "Website form: Request AV - joined the waitlist for this date",
    );
    expect(buildProjectDetails({ ...base, ending: "partial" }).split("\n")[0]).toBe(
      "Website form: Request AV - unfinished, added by staff",
    );
  });

  it("stays within 3500 characters (Proposals appends links to details)", () => {
    const out = buildProjectDetails({
      formName: "Get a Quote",
      ending: "completed",
      summaryLine: "x",
      lines: Array.from({ length: 200 }, (_, i) => `Answer ${i}: ${"y".repeat(40)}`),
    });
    expect(out.length).toBe(PROJECT_DETAILS_MAX);
    expect(out.endsWith("...")).toBe(true);
  });
});

describe("buildProjectInsert", () => {
  it("is a web_form project at stage Inquiry with the event facts", () => {
    expect(
      buildProjectInsert({ summary: summary(), clientId: "c1", details: "d", formSlug: "get-a-quote", submissionId: "sub-1" }),
    ).toEqual({
      name: "Jane Smith - Corporate Event",
      stage: INQUIRY_STAGE,
      client_id: "c1",
      project_type: "Corporate Event",
      project_date: "2027-05-15",
      budget: 25000,
      location: "Ponte Vedra",
      details: "d",
      source_event: WEB_FORM_SOURCE,
      raw: { form_slug: "get-a-quote", submission_id: "sub-1" },
    });
    expect(INQUIRY_STAGE).toBe("Inquiry");
  });

  it("leaves the date and budget empty when the visitor did not give them", () => {
    const row = buildProjectInsert({
      summary: summary({ eventDate: null, budgetLow: null, eventType: null, eventLocation: null }),
      clientId: null,
      details: "",
      formSlug: "request-av",
      submissionId: "sub-2",
    });
    expect(row).toMatchObject({ project_date: null, budget: null, project_type: "", location: "" });
    expect(buildProjectInsert({ summary: summary({ eventDate: "2027-02-30" }), clientId: null, details: "", formSlug: "x", submissionId: "s" }).project_date).toBeNull();
  });
});

describe("buildStageEventInsert", () => {
  it("records '' to Inquiry with no person", () => {
    expect(buildStageEventInsert("p1")).toEqual({ project_id: "p1", from_stage: "", to_stage: "Inquiry", changed_by: null });
  });
});

describe("the starter forms map onto the board as the spec says", () => {
  it("V1 Get a Quote: tier low bound as budget, Area as location, every answer in details", () => {
    const form = STARTER_FORMS.find((f) => f.slug === "get-a-quote");
    if (!form) throw new Error("missing V1");
    const answers: Answers = {
      full_name: "Jane Smith",
      phone: "904-555-0100",
      email: "Jane@Acme.com",
      company: "Acme Corp",
      event_type: "corporate_event",
      event_date: "2027-05-15",
      event_location: "ponte_vedra",
      venue: "TPC Sawgrass",
      guest_count: "field_150_300",
      services: ["audio_visuals", "planning"],
      budget: { type: "tier", tierId: "field_25_000_50_000" },
      notes: "Annual sales kickoff for 200 people, two days, keynote plus breakouts.",
      contact_preference: "email",
    };
    const s = buildCrmSummary(form.definition, answers, {}, "completed", "high");
    const row = buildProjectInsert({ summary: s, clientId: "c1", details: "d", formSlug: form.slug, submissionId: "sub-1" });
    expect(row).toMatchObject({
      name: "Jane Smith - Corporate Event",
      project_type: "Corporate Event",
      project_date: "2027-05-15",
      budget: 25000,
      location: "Ponte Vedra",
    });
    expect(buildClientInsert(s, "sub-1").email).toBe("jane@acme.com");
    const lines = formatAnswerLines(form.definition, answers);
    expect(lines).toContain("Venue if known: TPC Sawgrass");
    expect(lines).toContain("Guests: 150 - 300");
    expect(lines.some((l) => l.startsWith("Budget: $25,000 - $50,000"))).toBe(true);
  });

  it("V1 'Under $10,000' has no low bound, so the project budget stays empty", () => {
    const form = STARTER_FORMS[0];
    const s = buildCrmSummary(form.definition, { budget: { type: "tier", tierId: "under_10_000" } }, {}, "completed", null);
    expect(s.budgetLabel).toBe("Under $10,000");
    expect(buildProjectInsert({ summary: s, clientId: null, details: "", formSlug: "x", submissionId: "s" }).budget).toBeNull();
  });
});

describe("committed work on a date (bookingsOn)", () => {
  const row = (over: Partial<ProjectDayRow>): ProjectDayRow => ({
    id: "p",
    stage: "Inquiry",
    booked_at: null,
    project_date: "2027-05-15",
    ...over,
  });

  it("counts booked, retainer paid, planning and in progress, in Pipeline or Hub spelling", () => {
    for (const stage of ["Booked", "_BOOKED_", "_RETAINER_PAID_", "Retainer Paid", "_PAID_IN_FULL_", "Paid in Full", "_PLANNING_", "In Progress", "in_progress"]) {
      expect(isCommittedProject(row({ stage })), stage).toBe(true);
    }
    for (const stage of ["Inquiry", "Proposal Sent", "_PROPOSAL_SENT_", "Contract Sent", "Lost", "", null]) {
      expect(isCommittedProject(row({ stage })), String(stage)).toBe(false);
    }
  });

  it("counts booked_at too, unless the project was lost or archived later", () => {
    expect(isCommittedProject(row({ stage: "Completed", booked_at: "2027-01-02T10:00:00Z" }))).toBe(true);
    expect(isCommittedProject(row({ stage: "_CLOSED_", booked_at: "2027-01-02T10:00:00Z" }))).toBe(true);
    expect(isCommittedProject(row({ stage: "Lost", booked_at: "2027-01-02T10:00:00Z" }))).toBe(false);
    expect(isCommittedProject(row({ stage: "Archived", booked_at: "2027-01-02T10:00:00Z" }))).toBe(false);
    expect(isCommittedProject(row({ stage: "Not Booked", booked_at: "2027-01-02T10:00:00Z" }))).toBe(false);
  });

  it("counts each project once, on its own date only", () => {
    const rows = [
      row({ id: "a", stage: "Booked" }),
      row({ id: "a", stage: "Booked" }),
      row({ id: "b", stage: "_PLANNING_" }),
      row({ id: "c", stage: "Inquiry" }),
      row({ id: "d", stage: "Booked", project_date: "2027-05-16" }),
    ];
    expect(countCommittedOn(rows, "2027-05-15")).toBe(2);
    expect(countCommittedOn([], "2027-05-15")).toBe(0);
  });
});

describe("capacityFromPeople", () => {
  it("is the people in the departments minus approved time off", () => {
    expect(capacityFromPeople(["a", "b", "c"], ["b", "zz"])).toBe(2);
    expect(capacityFromPeople(["a"], ["a"])).toBe(0);
    expect(capacityFromPeople([], [])).toBeNull();
  });
});

describe("escapeIlike", () => {
  it("escapes % _ and backslash so ILIKE is an exact match", () => {
    expect(escapeIlike("jane_doe%x\\y@acme.com")).toBe("jane\\_doe\\%x\\\\y@acme.com");
  });
});
