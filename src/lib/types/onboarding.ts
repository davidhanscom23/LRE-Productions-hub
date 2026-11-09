export type OnboardingStatus = "active" | "complete" | "archived";
export type OnboardingCategory =
  | "accounts"
  | "equipment"
  | "paperwork"
  | "training"
  | "other";

export type OnboardingItem = {
  id: string;
  plan_id: string;
  label: string;
  category: OnboardingCategory;
  is_done: boolean;
  sort_order: number;
};

export type OnboardingPlan = {
  id: string;
  subject_name: string;
  profile_id: string | null;
  role_title: string;
  start_date: string | null;
  status: OnboardingStatus;
  created_at: string;
  items: OnboardingItem[];
};

export const ONBOARDING_CATEGORIES: {
  value: OnboardingCategory;
  label: string;
}[] = [
  { value: "accounts", label: "Accounts & access" },
  { value: "equipment", label: "Equipment" },
  { value: "paperwork", label: "Paperwork" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
];

export function onboardingCategoryLabel(c: OnboardingCategory): string {
  return ONBOARDING_CATEGORIES.find((x) => x.value === c)?.label ?? "Other";
}

/** Seeded when a plan is created. Admins can add/remove after. */
export const DEFAULT_ONBOARDING_ITEMS: {
  label: string;
  category: OnboardingCategory;
}[] = [
  { label: "Send hub invite & set up account", category: "accounts" },
  { label: "Set up company email", category: "accounts" },
  { label: "Add to team chat", category: "accounts" },
  { label: "Add to scheduling system", category: "accounts" },
  { label: "Assign gear / kit", category: "equipment" },
  { label: "Provide branded apparel", category: "equipment" },
  { label: "Complete W-4 / tax forms", category: "paperwork" },
  { label: "Set up direct deposit", category: "paperwork" },
  { label: "Sign the Staff Handbook", category: "paperwork" },
  { label: "Collect emergency contact info", category: "paperwork" },
  { label: "Complete required Training Portal courses", category: "training" },
  { label: "Shadow an event", category: "training" },
  { label: "Review SOPs / Support Guide", category: "training" },
  { label: "Add to People directory", category: "other" },
  { label: "Schedule 30-day check-in", category: "other" },
];
