/**
 * Inquiry Forms paths the middleware lets through without a login. PURE (no Next or Supabase
 * imports) so vitest can pin them; src/lib/supabase/middleware.ts calls both helpers.
 *
 * - The public form pages /inquire/<slug> (opened directly or inside the website iframe) and the
 *   /inquire/embed.js loader open signed out. The pages keep the normal session refresh, so an
 *   admin's draft preview (?preview=draft) still sees the login.
 * - The form API /api/inquire/* (every call carries its own submission token, checked in the
 *   route) and the embed script skip the session lookup entirely. The admin draft preview API
 *   (/api/inquire/preview/*) stays behind login, and the admin builder lives at /inquiry-forms.
 */

const INQUIRE_PAGE_PREFIX = "/inquire/";
const INQUIRE_API_PREFIX = "/api/inquire/";
/** Dry run of a DRAFT form: needs an admin session, never public. */
const INQUIRE_PREVIEW_API_PREFIX = "/api/inquire/preview/";
export const INQUIRE_EMBED_SCRIPT_PATH = "/inquire/embed.js";

/** Pages a signed-out visitor may open (both middleware allowlists). */
export function isInquiryPublicPage(pathname: string): boolean {
  return pathname.startsWith(INQUIRE_PAGE_PREFIX);
}

/**
 * Requests passed straight through with no session lookup: the public form API (POST, including
 * sendBeacon pings, plus CORS preflight) and the hosted embed script.
 */
export function isSessionlessInquiryRequest(pathname: string, method: string): boolean {
  if (pathname === INQUIRE_EMBED_SCRIPT_PATH) {
    return method === "GET" || method === "HEAD";
  }
  if (pathname.startsWith(INQUIRE_API_PREFIX) && !pathname.startsWith(INQUIRE_PREVIEW_API_PREFIX)) {
    return method === "POST" || method === "OPTIONS";
  }
  return false;
}
