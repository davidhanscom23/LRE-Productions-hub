import { describe, expect, it } from "vitest";
import {
  customerDocKindLabel,
  validateCustomerEsign,
} from "@/lib/av-erp/customer-esign";

describe("validateCustomerEsign", () => {
  it("allows decline without a signature", () => {
    const result = validateCustomerEsign({
      response: "declined",
      note: "Too expensive",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signatureData).toBeNull();
    expect(result.value.note).toBe("Too expensive");
  });

  it("requires name and drawn signature on accept", () => {
    expect(
      validateCustomerEsign({ response: "accepted", signerName: "Pat" }).ok,
    ).toBe(false);
    expect(
      validateCustomerEsign({
        response: "accepted",
        signatureData: "data:image/png;base64,abc",
      }).ok,
    ).toBe(false);

    const ok = validateCustomerEsign({
      response: "accepted",
      signerName: "Pat Lee",
      signerEmail: "pat@acme.test",
      signatureData: "data:image/png;base64,abc",
      ipAddress: "1.2.3.4",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.signerName).toBe("Pat Lee");
    expect(ok.value.signatureData?.startsWith("data:image/")).toBe(true);
  });

  it("labels document kinds for UI copy", () => {
    expect(customerDocKindLabel("estimate")).toBe("Estimate");
    expect(customerDocKindLabel("contract")).toBe("Contract");
    expect(customerDocKindLabel("change_order")).toBe("Change order");
  });
});
