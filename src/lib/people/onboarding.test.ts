import { describe, expect, it } from "vitest";
import {
  DEFAULT_ONBOARDING_RESOURCES,
  departmentsForOnboardingSlug,
  filterOnboardingForViewer,
  isAdminOnlyOnboardingSlug,
  withOnboardingMeta,
} from "./onboarding";

describe("DEFAULT_ONBOARDING_RESOURCES", () => {
  it("lists the six LRE onboarding cards", () => {
    expect(DEFAULT_ONBOARDING_RESOURCES.map((r) => r.title)).toEqual([
      "Corporate Onboarding Form",
      "Weddings & Social Onboarding Form",
      "Golf Onboarding Form",
      "AV Onboarding Form",
      "Office Onboarding Form",
      "Interview Questions - AV",
    ]);
  });

  it("marks only AV interview questions as admin-only", () => {
    expect(
      DEFAULT_ONBOARDING_RESOURCES.filter((r) => r.adminOnly).map((r) => r.slug),
    ).toEqual(["av-interview-questions"]);
  });
});

describe("slug helpers", () => {
  it("maps av- and wedding slugs to departments", () => {
    expect(departmentsForOnboardingSlug("av-onboarding-form")).toEqual([
      "Audiovisual",
    ]);
    expect(departmentsForOnboardingSlug("wedding-social-onboarding-form")).toEqual([
      "Wedding & Social",
    ]);
  });

  it("treats interview slugs as admin-only", () => {
    expect(isAdminOnlyOnboardingSlug("av-interview-questions")).toBe(true);
    expect(isAdminOnlyOnboardingSlug("corporate-onboarding-form")).toBe(false);
  });
});

describe("filterOnboardingForViewer", () => {
  const now = "2026-01-01T00:00:00.000Z";
  const resources = DEFAULT_ONBOARDING_RESOURCES.map((resource, index) =>
    withOnboardingMeta({
      ...resource,
      id: `id-${index}`,
      created_at: now,
      updated_at: now,
      url: resource.slug === "corporate-onboarding-form" ? "https://example.com" : "",
    }),
  );

  it("shows all cards to admins", () => {
    expect(
      filterOnboardingForViewer(resources, {
        role: "admin",
        departments: [],
      }),
    ).toHaveLength(6);
  });

  it("hides unset and admin-only cards from staff", () => {
    const visible = filterOnboardingForViewer(resources, {
      role: "staff",
      departments: ["Corporate"],
    });
    expect(visible.map((r) => r.slug)).toEqual(["corporate-onboarding-form"]);
  });
});
