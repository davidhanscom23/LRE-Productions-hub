/**
 * Dashboard URL for inviting users in Supabase Auth.
 * Derived from NEXT_PUBLIC_SUPABASE_URL (project ref subdomain).
 */
export function supabaseAuthUsersDashboardUrl(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    const host = url.hostname;

    // Hosted: https://<project-ref>.supabase.co
    const hosted = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    if (hosted?.[1]) {
      return `https://supabase.com/dashboard/project/${hosted[1]}/auth/users`;
    }

    // Local Supabase Studio (default)
    if (host === "127.0.0.1" || host === "localhost") {
      return "http://127.0.0.1:54323/project/default/auth/users";
    }
  } catch {
    return null;
  }

  return null;
}
