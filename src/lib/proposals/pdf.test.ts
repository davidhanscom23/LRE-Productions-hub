import { describe, expect, it } from "vitest";
import { buildProposalPdf, proposalFileName } from "@/lib/proposals/pdf";

describe("proposal PDF", () => {
  it("builds a non-empty PDF buffer", async () => {
    const bytes = await buildProposalPdf({
      title: "Proposal — Test Client",
      clientName: "Test Client",
      eventName: "Spring Gala",
      eventDate: "2026-06-01",
      department: "Wedding & Social",
      intro: "Thank you for considering Vident Productions.",
      notes: "Deposit due on booking.",
      lines: [
        {
          label: "DJ package",
          quantity: 1,
          list_unit_price: 2000,
          quote_unit_price: 2000,
        },
        {
          label: "Uplighting",
          quantity: 8,
          list_unit_price: 35,
          quote_unit_price: 30,
        },
      ],
      preparedBy: "Admin Test",
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    // PDF magic
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe(
      "%PDF",
    );
  });

  it("builds a safe file name", () => {
    expect(
      proposalFileName({
        clientName: "Smith / Jones!",
        eventName: "Wedding",
        eventDate: "2026-08-15",
      }),
    ).toMatch(/^Vident-Proposal-Smith-Jones-Wedding-2026-08-15\.pdf$/);
  });
});
