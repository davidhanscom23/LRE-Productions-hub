import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GearBoard, TaggedUnit } from "@/lib/gear-tags/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/app/(app)/gear-scan/actions", () => ({
  linkTagAction: vi.fn(),
  lookupTagAction: vi.fn(),
  reviewGearRequestAction: vi.fn(),
  scanTagAction: vi.fn(),
  suggestGearChangeAction: vi.fn(),
  updateUnitAction: vi.fn(),
}));

import { GearScanClient } from "./gear-scan-client";

function unit(over: Partial<TaggedUnit>): TaggedUnit {
  return {
    id: "u1",
    tag: "0001",
    productId: "p1",
    productName: "SAMPLE Speaker",
    label: "Speaker 1",
    serial: "TAG-0001",
    status: "in",
    isCase: false,
    caseUnitId: null,
    owner: "lukesent",
    outProjectId: null,
    outProjectName: "",
    outSince: null,
    ...over,
  };
}

const board: GearBoard = {
  units: [
    unit({}),
    unit({ id: "u2", tag: "0002", status: "out", outProjectId: "e1", outProjectName: "SAMPLE Gala", outSince: "2026-11-20T18:00:00Z" }),
    unit({ id: "u3", tag: null, serial: "OLD-1" }),
  ],
  products: [{ id: "p1", name: "SAMPLE Speaker", owner: "lukesent" }],
  projects: [{ id: "e1", name: "SAMPLE Gala", date: "2026-11-21" }],
  requests: [
    {
      id: "r1",
      kind: "add",
      tag: null,
      unitId: null,
      summary: "Add gear",
      details: "We have a new mixer",
      status: "pending",
      requestedByName: "Sample Staff",
      requestedAt: "2026-11-20T17:00:00Z",
      reviewNote: "",
      mine: false,
    },
  ],
  isAdmin: true,
};

describe("GearScanClient", () => {
  it("renders the scan tab with counts from the board", () => {
    const html = renderToStaticMarkup(<GearScanClient board={board} initialTag="" initialProjectId="e1" />);
    expect(html).toContain("Gear scan");
    expect(html).toContain("Still out (1)");
    expect(html).toContain("Tagged gear (2)");
    expect(html).toContain("Requests (1)");
    expect(html).toContain("SAMPLE Gala");
    expect(html).toContain("Start camera");
    expect(html).toContain("No event (just leaving the warehouse)");
  });

  it("opens in Look up when it arrives from a tag link", () => {
    const html = renderToStaticMarkup(<GearScanClient board={board} initialTag="0001" initialProjectId="" />);
    expect(html).toContain("Changes nothing");
    expect(html).not.toContain("Event the gear is going to");
  });
});
