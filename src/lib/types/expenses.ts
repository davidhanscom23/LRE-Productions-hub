export type ExpenseCategory =
  | "travel"
  | "mileage"
  | "gear"
  | "meals"
  | "supplies"
  | "other";

export type ExpenseStatus = "pending" | "approved" | "denied";

export type ExpenseRequest = {
  id: string;
  user_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  expense_date: string;
  receipt_url: string;
  receipt_storage_path?: string;
  receipt_storage_provider?: "supabase" | "bunny" | string;
  receipt_file_name?: string;
  /** Signed/CDN URL for an uploaded receipt when storage path is set. */
  receipt_access_url?: string | null;
  status: ExpenseStatus;
  reimbursed_at: string | null;
  review_note: string;
  created_at: string;
  /** Joined for admin views. */
  requester_name?: string;
};

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "travel", label: "Travel" },
  { value: "mileage", label: "Mileage" },
  { value: "gear", label: "Gear / Equipment" },
  { value: "meals", label: "Meals" },
  { value: "supplies", label: "Supplies" },
  { value: "other", label: "Other" },
];

export function expenseCategoryLabel(category: ExpenseCategory): string {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? "Other"
  );
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
