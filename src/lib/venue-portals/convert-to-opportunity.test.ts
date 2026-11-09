import { describe, expect, it } from "vitest";
import {
  eventDaysToGearLocalBounds,
  venueSelectionToOpportunityLines,
  venueTotalsToOpportunityLines,
} from "./convert-to-opportunity";

describe("venueTotalsToOpportunityLines", () => {
  it("flattens packages, addons, fees, tech, and savings", () => {
    const lines = venueTotalsToOpportunityLines({
      spaces: [
        {
          spaceId: "s1",
          spaceName: "Ballroom",
          packageLine: { label: "Complete Meeting package", amount: 2000 },
          addonLines: [{ label: "Wireless mic", amount: 150, detail: "2 x" }],
        },
      ],
      setup: 350,
      delivery: 250,
      technician: { hours: 0, amount: 0 },
      technicians: [
        {
          name: "Audio",
          rateType: "hourly",
          units: 4,
          amount: 400,
        },
      ],
      equipment: 2150,
      subtotal: 3150,
      savingsLabel: "Partner Savings",
      savings: 200,
      total: 2950,
    });

    expect(lines.map((l) => l.description)).toEqual([
      "Ballroom: Complete Meeting package",
      "Ballroom: Wireless mic (2 x)",
      "Setup / strike",
      "Audio (4 hrs)",
      "Delivery",
      "Partner Savings",
    ]);
    expect(lines.find((l) => l.description === "Partner Savings")?.unitPrice).toBe(
      -200,
    );
    const sum = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    expect(sum).toBe(2950);
  });

  it("returns empty for missing totals", () => {
    expect(venueTotalsToOpportunityLines(null)).toEqual([]);
    expect(venueTotalsToOpportunityLines(undefined)).toEqual([]);
  });
});

describe("venueSelectionToOpportunityLines", () => {
  it("attaches mapped product/service ids from portal catalog", () => {
    const lines = venueSelectionToOpportunityLines({
      selection: [
        {
          spaceId: "s1",
          spaceName: "Ballroom",
          packageId: "pkg1",
          addons: { add1: 2 },
        },
      ],
      totals: {
        spaces: [
          {
            spaceId: "s1",
            spaceName: "Ballroom",
            packageLine: { label: "Complete Meeting package", amount: 2000 },
            addonLines: [{ label: "Wireless mic", amount: 150, detail: "2 x" }],
          },
        ],
        setup: 350,
        delivery: 0,
        technician: { hours: 0, amount: 0 },
        technicians: [],
        equipment: 2150,
        subtotal: 2500,
        savingsLabel: "",
        savings: 0,
        total: 2500,
      },
      packages: [
        {
          id: "pkg1",
          name: "Complete Meeting",
          avProductId: "prod-1",
          avServiceId: null,
        },
      ],
      addons: [
        {
          id: "add1",
          name: "Wireless mic",
          avProductId: null,
          avServiceId: "svc-1",
        },
      ],
    });

    expect(lines[0]).toMatchObject({
      description: "Ballroom: Complete Meeting package",
      unitPrice: 2000,
      productId: "prod-1",
      serviceId: null,
    });
    expect(lines[1]).toMatchObject({
      description: "Ballroom: Wireless mic (2 x)",
      unitPrice: 150,
      productId: null,
      serviceId: "svc-1",
    });
    expect(lines.some((l) => l.description === "Setup / strike")).toBe(true);
  });

  it("falls back to totals-only when selection is empty", () => {
    const lines = venueSelectionToOpportunityLines({
      selection: [],
      totals: {
        spaces: [
          {
            spaceId: "s1",
            spaceName: "A",
            packageLine: { label: "Pkg", amount: 100 },
            addonLines: [],
          },
        ],
        setup: 0,
        delivery: 0,
        technician: { hours: 0, amount: 0 },
        technicians: [],
        equipment: 100,
        subtotal: 100,
        savingsLabel: "",
        savings: 0,
        total: 100,
      },
      packages: [],
      addons: [],
    });
    expect(lines).toEqual([
      { description: "A: Pkg", qty: 1, unitPrice: 100 },
    ]);
  });
});

describe("eventDaysToGearLocalBounds", () => {
  it("uses first start and last end", () => {
    expect(
      eventDaysToGearLocalBounds([
        { date: "2026-11-12", startTime: "18:00", endTime: "22:00" },
        { date: "2026-11-11", startTime: "09:00", endTime: "17:00" },
      ]),
    ).toEqual({
      startLocal: "2026-11-11T09:00",
      endLocal: "2026-11-12T22:00",
    });
  });
});

