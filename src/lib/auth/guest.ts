import type { UserRole } from "@/lib/types/database";

/** Modules guests may open (read-only). Everything else redirects home. */
export const GUEST_ALLOWED_PATHS = [
  "/",
  "/resources",
  "/support-guide",
  "/training-portal",
] as const;

export function isGuestRole(role: UserRole | string | null | undefined): boolean {
  return role === "guest";
}

export function guestCanAccessPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return GUEST_ALLOWED_PATHS.some((prefix) => {
    if (prefix === "/") return false;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

/** Safe post-login landing for guests (ignore deep links into staff routes). */
export function guestSafeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return guestCanAccessPath(next) ? next : "/";
}
