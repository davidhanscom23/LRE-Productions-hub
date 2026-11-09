import type { ThemePreference } from "@/lib/theme/preference";

export type UserRole = "admin" | "trainer" | "staff" | "guest";

export type Department =
  | "Audiovisual"
  | "Corporate"
  | "Wedding & Social"
  | "Golf"
  | "Office";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  departments: Department[];
  title: string | null;
  phone: string | null;
  birthday: string | null;
  start_date: string | null;
  bio: string | null;
  /** Optional public social profile URLs. */
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  is_active: boolean;
  /** Optional #RRGGBB identity color for cards/calendar/legend. */
  color: string | null;
  /** Manager profile id for org chart; null = top-level. */
  reports_to: string | null;
  /** Hub Appearance: light, dark, or system. Null = unset. */
  theme_preference: ThemePreference | null;
  /**
   * When true, excluded from monthly Hub trophy awards.
   * Optional until migration 079 is applied.
   */
  award_excluded?: boolean;
  created_at: string;
  updated_at: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  /** Internal role key remains `trainer`; display name is Lead. */
  trainer: "Lead",
  staff: "Staff",
  guest: "Guest",
};

export const DEPARTMENTS: Department[] = [
  "Audiovisual",
];

/** Roles assignable in People / invites — never include guest. */
export const ROLES: UserRole[] = ["admin", "trainer", "staff"];

export function normalizeDepartments(
  value: unknown,
): Department[] {
  if (!Array.isArray(value)) return [];
  return value.filter((d): d is Department =>
    DEPARTMENTS.includes(d as Department),
  );
}
