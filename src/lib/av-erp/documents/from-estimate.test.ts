import { describe, expect, it } from "vitest";
import { buildCustomerEstimate } from "@/lib/av-erp/estimate-view";
import { rmsDocumentFromEstimate } from "@/lib/av-erp/documents/from-estimate";

describe("rmsDocumentFromEstimate terms", () => {
  const estimate = buildCustomerEstimate({
    reference: "Q-0100",
    subject: "Terms test",
    surchargePct: 0,
    discountPct: 0,
    venueMarkupEnabled: false,
    terms: "ESTIMATE TERMS",
    contractTerms: "AGREEMENT TERMS",
    groups: [],
    lines: [],
  });

  it("prints agreement terms only on the agreement", () => {
    expect(rmsDocumentFromEstimate(estimate, "contract").terms).toBe(
      "AGREEMENT TERMS",
    );
  });

  it("keeps the normal terms on estimates and never shows agreement terms there", () => {
    const doc = rmsDocumentFromEstimate(estimate, "estimate");
    expect(doc.terms).toBe("ESTIMATE TERMS");
    expect(doc.terms).not.toContain("AGREEMENT");
  });

  it("prints no terms on the agreement when no Agreement template exists", () => {
    const bare = { ...estimate, contractTerms: undefined };
    expect(rmsDocumentFromEstimate(bare, "contract").terms).toBe("");
  });
});
