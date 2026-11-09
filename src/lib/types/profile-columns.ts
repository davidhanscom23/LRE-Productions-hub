/** Columns safe to select for directory / shell (excludes sensitive columns). */
export const PROFILE_SAFE_COLUMNS =
  "id, email, full_name, role, avatar_url, departments, title, phone, birthday, start_date, bio, facebook_url, instagram_url, linkedin_url, twitter_url, is_active, color, reports_to, theme_preference, created_at, updated_at" as const;

/** Fallback before migration 048 (no social URL columns yet) or before social column grants. */
export const PROFILE_SAFE_COLUMNS_PRE_SOCIAL =
  "id, email, full_name, role, avatar_url, departments, title, phone, birthday, start_date, bio, is_active, color, reports_to, theme_preference, created_at, updated_at" as const;

/** Fallback before migration 019 (no theme_preference column yet). */
export const PROFILE_SAFE_COLUMNS_PRE_THEME =
  "id, email, full_name, role, avatar_url, departments, title, phone, birthday, start_date, bio, is_active, color, reports_to, created_at, updated_at" as const;

/** True when a profiles select failed due to missing social columns or column grants. */
export function isProfilesSocialSelectError(message: string): boolean {
  return /facebook_url|instagram_url|linkedin_url|twitter_url|permission denied|column/i.test(
    message,
  );
}

/** True when a profiles select failed due to missing theme_preference. */
export function isProfilesThemeSelectError(message: string): boolean {
  return /theme_preference|permission denied|column/i.test(message);
}
