export type HiringApplicationStatus =
  | "pending"
  | "promoted"
  | "archived"
  | "rejected";

export type HiringApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role_interest: string;
  message: string;
  resume_url: string;
  assessment_track: string;
  assessment_answers: Record<string, string>;
  status: HiringApplicationStatus;
  candidate_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export const HIRING_ROLE_INTERESTS = [
  "Audiovisual",
  "Corporate",
  "Wedding & Social",
  "Golf",
  "Office",
  "Other",
] as const;

/** Roles offered on /apply/general (department tracks cover the rest). */
export const GENERAL_HIRING_ROLE_INTERESTS = [
  "Office",
  "Other",
] as const;
