/** Shared validation for customer e-sign on estimates, contracts, change orders. */

export type CustomerDocKind = "estimate" | "contract" | "change_order";
export type CustomerDocResponse = "accepted" | "declined";

export const MAX_SIGNATURE_DATA_CHARS = 600_000;
export const MAX_RESPONSE_NOTE_CHARS = 2000;

export type CustomerEsignInput = {
  response: CustomerDocResponse;
  signerName?: string;
  signerEmail?: string;
  signatureData?: string;
  note?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CustomerEsignValidated = {
  response: CustomerDocResponse;
  signerName: string;
  signerEmail: string;
  signatureData: string | null;
  note: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export function validateCustomerEsign(
  input: CustomerEsignInput,
): { ok: true; value: CustomerEsignValidated } | { ok: false; error: string } {
  if (input.response !== "accepted" && input.response !== "declined") {
    return { ok: false, error: "Choose Accept or Decline." };
  }

  const note = String(input.note ?? "").trim().slice(0, MAX_RESPONSE_NOTE_CHARS);
  const signerName = String(input.signerName ?? "").trim().slice(0, 200);
  const signerEmail = String(input.signerEmail ?? "").trim().slice(0, 320);
  const signatureData = String(input.signatureData ?? "").trim();
  const ipAddress = String(input.ipAddress ?? "").trim().slice(0, 128) || null;
  const userAgent = String(input.userAgent ?? "").trim().slice(0, 500) || null;

  if (input.response === "declined") {
    return {
      ok: true,
      value: {
        response: "declined",
        signerName: "",
        signerEmail: "",
        signatureData: null,
        note,
        ipAddress,
        userAgent,
      },
    };
  }

  if (!signerName) {
    return { ok: false, error: "Full name is required to accept." };
  }
  if (!signatureData.startsWith("data:image/")) {
    return { ok: false, error: "Please draw your signature to accept." };
  }
  if (signatureData.length > MAX_SIGNATURE_DATA_CHARS) {
    return { ok: false, error: "Signature image is too large. Please clear and redraw." };
  }

  return {
    ok: true,
    value: {
      response: "accepted",
      signerName,
      signerEmail,
      signatureData,
      note,
      ipAddress,
      userAgent,
    },
  };
}

export function customerDocKindLabel(kind: CustomerDocKind): string {
  switch (kind) {
    case "estimate":
      return "Estimate";
    case "contract":
      return "Contract";
    case "change_order":
      return "Change order";
  }
}
