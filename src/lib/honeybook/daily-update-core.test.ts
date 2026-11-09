import { describe, expect, it } from "vitest";

import {
  buildAdminEmail,
  buildStaffEmail,
  countNeedsAttention,
  isClosedStage,
  daysSince,
  daysUntil,
  suggestActions,
  type DigestProject,
  type StaffDigest,
} from "@/lib/honeybook/daily-update-core";

const TODAY = "2026-11-06";
const BASE = "https://hub.example.com";

function project(over: Partial<DigestProject> = {}): DigestProject {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Wedding – Jane Doe",
    clientName: "Jane Doe",
    stage: "Inquiry",
    projectDate: "2027-06-12",
    location: "Ponte Vedra",
    role: "lead",
    lastActivityAt: "2026-11-06T10:00:00.000Z",
    lastNote: "",
    openActions: [],
    ...over,
  };
}

function digest(projects: DigestProject[], name = "Kallie Sango"): StaffDigest {
  return { staffId: "s1", name, email: "kallie@videntproductions.com", projects, tasks: [] };
}

describe("date helpers", () => {
  it("counts whole days", () => {
    expect(daysUntil("2026-11-16", TODAY)).toBe(10);
    expect(daysUntil("2026-11-01", TODAY)).toBe(-5);
    expect(daysUntil(null, TODAY)).toBeNull();
    expect(daysSince("2026-11-03T05:00:00Z", TODAY)).toBe(3);
  });
});

describe("suggestActions", () => {
  it("flags an inquiry with no logged activity", () => {
    const out = suggestActions(project({ lastActivityAt: null }), TODAY);
    expect(out[0]).toMatch(/no reply logged/i);
  });

  it("flags a quiet proposal after 3 days", () => {
    const out = suggestActions(
      project({ stage: "Proposal Sent", lastActivityAt: "2026-11-01T12:00:00Z" }),
      TODAY,
    );
    expect(out.join(" ")).toMatch(/quiet for 5 days/);
  });

  it("flags a close event that is not booked yet", () => {
    const out = suggestActions(
      project({ stage: "Proposal Sent", projectDate: "2026-11-12", lastActivityAt: "2026-11-06T09:00:00Z" }),
      TODAY,
    );
    expect(out.join(" ")).toMatch(/in 6 days/);
  });

  it("does not nag about booked events or closed projects", () => {
    expect(
      suggestActions(project({ stage: "Booked", projectDate: "2026-11-12" }), TODAY),
    ).toEqual([]);
    expect(suggestActions(project({ stage: "Completed", lastActivityAt: null }), TODAY)).toEqual([]);
  });

  it("flags a past event date still open", () => {
    const out = suggestActions(
      project({ stage: "Booked", projectDate: "2026-11-04", lastActivityAt: "2026-11-05T00:00:00Z" }),
      TODAY,
    );
    expect(out.join(" ")).toMatch(/passed 2 days ago/);
  });
});

describe("countNeedsAttention", () => {
  it("adds note to-dos, suggestions, and due tasks", () => {
    const d = digest([project({ openActions: ["Send quote"], lastActivityAt: null })]);
    d.tasks = [{ title: "Call venue", dueDate: "2026-11-05", projectName: "" }];
    // 1 open action + 1 "no reply" suggestion + 1 overdue task
    expect(countNeedsAttention(d, TODAY)).toBe(3);
  });
});

describe("emails", () => {
  it("staff email leads with needs-action and links to the project", () => {
    const d = digest([project({ openActions: ["Send quote"] })]);
    const email = buildStaffEmail(d, TODAY, BASE);
    expect(email.subject).toMatch(/need/);
    expect(email.text).toContain("Hi Kallie");
    expect(email.text).toContain("NEEDS ACTION");
    expect(email.text).toContain("Send quote");
    expect(email.text).toContain(`${BASE}/honeybook/projects/${d.projects[0].id}`);
    expect(email.html).toContain("<h3>Needs action</h3>");
  });

  it("escapes HTML in notes", () => {
    const d = digest([project({ openActions: ["<script>alert(1)</script>"] })]);
    expect(buildStaffEmail(d, TODAY, BASE).html).not.toContain("<script>");
  });

  it("admin email is one combined message with every person and unassigned inquiries", () => {
    const a = digest([project({ openActions: ["Send quote"] })], "Kallie Sango");
    const b = digest([project({ id: "22222222-2222-2222-2222-222222222222", name: "Gala", stage: "Booked" })], "Natalie McBride");
    const email = buildAdminEmail({
      digests: [a, b],
      unassigned: [{ id: "33333333-3333-3333-3333-333333333333", name: "Golf Outing", clientName: "Acme", createdAt: "2026-11-05T12:00:00Z" }],
      syncIssues: ["kristin@videntproductions.com: unauthorized_client"],
      todayIso: TODAY,
      siteBase: BASE,
    });
    expect(email.text).toContain("KALLIE SANGO");
    expect(email.text).toContain("NATALIE MCBRIDE");
    expect(email.text).toContain("UNASSIGNED INQUIRIES");
    expect(email.text).toContain("Golf Outing");
    expect(email.text).toContain("EMAIL MONITORING ISSUES");
  });
});

describe("partnerships in the daily update", () => {
  const today = "2026-11-10";
  const base = {
    id: "p1",
    name: "Grand Ballroom",
    clientName: "",
    stage: "In Talks",
    projectDate: null,
    location: "",
    role: "lead" as const,
    kind: "partnership" as const,
    lastActivityAt: "2026-11-09T12:00:00Z",
    lastNote: "",
    openActions: [] as string[],
  };

  it("includes open to-dos in the staff email, labelled as a partnership", () => {
    const email = buildStaffEmail(
      {
        staffId: "s1",
        name: "Jordan Lee",
        email: "j@x.com",
        projects: [{ ...base, openActions: ["Send the venue our rate sheet"] }],
        tasks: [],
      },
      today,
      "https://hub.example.com",
    );
    expect(email.text).toContain("Send the venue our rate sheet");
    expect(email.text).toContain("[Partnership] Grand Ballroom");
    expect(email.html).toContain("[Partnership]");
    expect(email.text).not.toContain("EVENTS IN THE NEXT 30 DAYS");
  });

  it("nudges only when quiet for two weeks and never for active partners", () => {
    expect(suggestActions(base, today)).toEqual([]);
    expect(
      suggestActions({ ...base, lastActivityAt: "2026-10-01T00:00:00Z" }, today),
    ).toHaveLength(1);
    expect(
      suggestActions(
        { ...base, stage: "Active Partner", lastActivityAt: "2026-10-01T00:00:00Z" },
        today,
      ),
    ).toEqual([]);
  });

  it("treats Not Moving Forward as closed", () => {
    expect(isClosedStage("Not Moving Forward")).toBe(true);
  });

  it("lists unassigned partnerships with open to-dos in the admin email", () => {
    const email = buildAdminEmail({
      digests: [],
      unassigned: [],
      unassignedPartnerships: [
        { id: "p9", name: "Cake Co", openActions: ["Call about samples"] },
      ],
      syncIssues: [],
      todayIso: today,
      siteBase: "https://hub.example.com",
    });
    expect(email.text).toContain("Cake Co");
    expect(email.text).toContain("Call about samples");
  });
});
