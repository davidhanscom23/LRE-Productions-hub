import { describe, expect, it } from "vitest";
import { ROLE_HELP as CATALOG_ROLE_HELP } from "@/components/inquiry-forms/admin/builder-catalog";
import { FIELD_ROLES } from "./types";
import { BUILDER_COPY, CRM_WORDS, HUB_COPY, ROLE_HELP } from "./hub-copy";

describe("Vident hub copy", () => {
  it("never calls an inquiry a lead ('Lead' is a staff role in this hub)", () => {
    const strings = [
      ...Object.values(CRM_WORDS),
      ...Object.values(HUB_COPY),
      ...Object.values(BUILDER_COPY),
      ...Object.values(ROLE_HELP),
    ];
    for (const s of strings) expect(s, s).not.toMatch(/\blead/i);
  });

  it("describes every role, and the builder shows these words", () => {
    for (const role of FIELD_ROLES) expect(ROLE_HELP[role]).toBeTruthy();
    expect(CATALOG_ROLE_HELP).toBe(ROLE_HELP);
  });

  it("names this hub's nav group above the page titles, never Y?'s Event Planner", () => {
    expect(HUB_COPY.sectionEyebrow).toBe("Quotes & Proposals");
  });
});
