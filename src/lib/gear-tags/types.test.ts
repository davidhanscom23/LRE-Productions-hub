import { describe, expect, it } from "vitest";
import { AV_OWNER_COMPANIES, ownerCompanyLabel } from "@/lib/av-erp/types";
import { OWNER_LABELS } from "./types";

describe("gear owner labels", () => {
  it("uses the three names David chose", () => {
    expect(OWNER_LABELS).toEqual({ vident: "Vident", lukesent: "LukesENT", lre: "LRE Pro" });
  });

  it("matches the AV Catalog for every owner", () => {
    for (const { value, label } of AV_OWNER_COMPANIES) {
      expect(OWNER_LABELS[value]).toBe(label);
      expect(ownerCompanyLabel(value)).toBe(label);
    }
  });
});
