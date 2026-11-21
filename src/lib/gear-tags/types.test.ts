import { describe, expect, it } from "vitest";
import { ownerCompanyLabel } from "@/lib/av-erp/types";
import { OWNER_LABELS } from "./types";

describe("gear owner labels", () => {
  it("names Luke's company the same way the AV Catalog does", () => {
    expect(OWNER_LABELS.lukesent).toBe("LukesENT");
    expect(OWNER_LABELS.lukesent).toBe(ownerCompanyLabel("lukesent"));
  });
});
