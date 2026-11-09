export type ContractorPayCategory =
  | "event_day"
  | "hourly"
  | "flat_fee"
  | "bonus"
  | "other";

export type ContractorPayStatus = "pending" | "approved" | "denied";

export type ContractorPaymentRequest = {
  id: string;
  user_id: string;
  amount: number;
  category: ContractorPayCategory;
  description: string;
  work_date: string;
  event_name: string;
  hours: number | null;
  status: ContractorPayStatus;
  paid_at: string | null;
  review_note: string;
  created_at: string;
  requester_name?: string;
};

export type Contractor1099Ack = {
  id: string;
  user_id: string;
  tax_year: number;
  signer_name: string;
  signer_email: string;
  signed_at: string;
  requester_name?: string;
};

export type ContractorW9File = {
  id: string;
  user_id: string;
  tax_year: number;
  storage_path: string;
  storage_provider: string;
  file_name: string;
  content_type: string;
  uploaded_at: string;
  access_url?: string | null;
  requester_name?: string;
};

export const CONTRACTOR_PAY_CATEGORIES: {
  value: ContractorPayCategory;
  label: string;
}[] = [
  { value: "event_day", label: "Event day" },
  { value: "hourly", label: "Hourly" },
  { value: "flat_fee", label: "Flat fee" },
  { value: "bonus", label: "Bonus" },
  { value: "other", label: "Other" },
];

export function contractorPayCategoryLabel(
  category: ContractorPayCategory,
): string {
  return (
    CONTRACTOR_PAY_CATEGORIES.find((c) => c.value === category)?.label ??
    "Other"
  );
}

export function formatContractorMoney(amount: number): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function currentTaxYear(now = new Date()): number {
  return now.getFullYear();
}

/** Plain-language annual acknowledgment shown before e-sign. */
export const CONTRACTOR_1099_ACK_TEXT = `I acknowledge that I am engaged by Vident Productions as an independent contractor (1099) for the tax year shown. I understand that Vident may issue a Form 1099-NEC (or other required information return) for amounts paid to me, that I am responsible for my own federal and state income taxes and self-employment taxes, and that I am not an employee for tax-withholding purposes unless separately classified as W-2 staff. I confirm that the W-9 I have provided (or will provide) is accurate and current.`;
