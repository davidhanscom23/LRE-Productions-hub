import { describe, expect, it } from "vitest";
import {
  computeQuote,
  dayHours,
  totalEventHours,
  type PricingAddon,
  type PricingPackage,
  type PortalRates,
} from "@/lib/venue-portals/pricing";

// Example rates chosen to reproduce a real third-party portal we studied, so the
// model is validated against known-good totals. Real LRE rates are per venue.
const rates: PortalRates = {
  deliveryFee: 150,
  techHourlyRate: 120,
  savingsPct: 10,
  savingsLabel: "Partner Savings",
};
const packages: PricingPackage[] = [
  { id: "gs", name: "General Session", price: 1340, setupFee: 225, includesTechnician: true },
  { id: "pp", name: "Projector Presentation", price: 432, setupFee: 112.5, includesTechnician: false },
];
const addons: PricingAddon[] = [
  { id: "mic", name: "Extra wireless handheld mic", unitPrice: 90, priceUnit: "each", minQuantity: 0 },
  { id: "tech", name: "On-site technician", unitPrice: 120, priceUnit: "hour", minQuantity: 2 },
];
const days = [{ startTime: "18:00", endTime: "22:00" }];

describe("computeQuote", () => {
  it("matches the two-space General Session reference total", () => {
    const q = computeQuote({
      rates, packages, addons, days,
      selections: [
        { spaceId: "a", spaceName: "A", packageId: "gs", addons: {} },
        { spaceId: "b", spaceName: "B", packageId: "gs", addons: {} },
      ],
    });
    expect(q.delivery).toBe(150);
    expect(q.setup).toBe(450);
    expect(q.technician).toEqual({ hours: 8, amount: 960 });
    expect(q.subtotal).toBe(4240);
    expect(q.savings).toBe(268);
    expect(q.total).toBe(3972);
  });

  it("matches the mixed-package + add-on reference total", () => {
    const q = computeQuote({
      rates, packages, addons, days,
      selections: [
        { spaceId: "a", spaceName: "A", packageId: "gs", addons: { mic: 1 } },
        { spaceId: "b", spaceName: "B", packageId: "pp", addons: {} },
      ],
    });
    expect(q.setup).toBe(337.5);
    expect(q.technician.amount).toBe(480);
    expect(q.subtotal).toBe(2829.5);
    expect(q.savings).toBe(186.2);
    expect(q.total).toBe(2643.3);
  });

  it("bills hourly add-ons at the minimum and excludes them from savings", () => {
    const q = computeQuote({
      rates, packages, addons, days,
      selections: [{ spaceId: "a", spaceName: "A", packageId: null, addons: { tech: 1 } }],
    });
    expect(q.spaces[0].addonLines[0]).toMatchObject({ amount: 240, detail: "2 hrs" });
    expect(q.equipment).toBe(0);
    expect(q.savings).toBe(0);
    expect(q.subtotal).toBe(390); // 240 labor + 150 delivery
  });

  it("charges nothing, including delivery, when nothing is selected", () => {
    const q = computeQuote({
      rates, packages, addons, days,
      selections: [{ spaceId: "a", spaceName: "A", packageId: null, addons: {} }],
    });
    expect(q.subtotal).toBe(0);
    expect(q.total).toBe(0);
  });

  it("ignores unknown ids and non-positive quantities", () => {
    const q = computeQuote({
      rates, packages, addons, days,
      selections: [{ spaceId: "a", spaceName: "A", packageId: "nope", addons: { ghost: 3, mic: 0, mic2: -1 } }],
    });
    expect(q.total).toBe(0);
  });

  it("caps savings at 100% of equipment", () => {
    const q = computeQuote({
      rates: { ...rates, savingsPct: 250 }, packages, addons, days,
      selections: [{ spaceId: "a", spaceName: "A", packageId: "pp", addons: {} }],
    });
    expect(q.savings).toBe(432);
  });
});

describe("event hours", () => {
  it("handles an event that ends after midnight", () => {
    expect(dayHours({ startTime: "22:00", endTime: "02:00" })).toBe(4);
  });
  it("sums multiple days and tolerates bad times", () => {
    expect(
      totalEventHours([
        { startTime: "09:00", endTime: "17:00" },
        { startTime: "09:00", endTime: "12:30" },
        { startTime: "", endTime: "nope" },
      ]),
    ).toBe(11.5);
  });
  it("scales technician cost across multiple days", () => {
    const q = computeQuote({
      rates, packages, addons,
      days: [
        { startTime: "09:00", endTime: "17:00" },
        { startTime: "09:00", endTime: "17:00" },
      ],
      selections: [{ spaceId: "a", spaceName: "A", packageId: "gs", addons: {} }],
    });
    expect(q.technician).toEqual({ hours: 16, amount: 1920 });
  });

  it("bills hourly and daily technician roles per space", () => {
    const technicians = [
      { id: "aud", name: "Audio Technician", rateType: "hourly" as const, rate: 100 },
      { id: "vid", name: "Video Technician", rateType: "daily" as const, rate: 600 },
    ];
    const pk: PricingPackage[] = [
      { id: "gs", name: "General Session", price: 1000, setupFee: 0, includesTechnician: true, technicianIds: ["aud", "vid"] },
    ];
    const q = computeQuote({
      rates: { ...rates, deliveryFee: 0, savingsPct: 0 },
      packages: pk, addons: [], technicians,
      days: [
        { startTime: "09:00", endTime: "13:00" },
        { startTime: "09:00", endTime: "13:00" },
      ],
      selections: [
        { spaceId: "a", spaceName: "A", packageId: "gs", addons: {} },
        { spaceId: "b", spaceName: "B", packageId: "gs", addons: {} },
      ],
    });
    // audio: 8 hrs x 2 spaces x $100 = 1600; video: 2 days x 2 spaces x $600 = 2400
    expect(q.technicians).toEqual([
      { name: "Audio Technician", rateType: "hourly", units: 16, amount: 1600 },
      { name: "Video Technician", rateType: "daily", units: 4, amount: 2400 },
    ]);
    expect(q.technician).toEqual({ hours: 16, amount: 4000 });
    expect(q.total).toBe(2000 + 4000);
  });
});
