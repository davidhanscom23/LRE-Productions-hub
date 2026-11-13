import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { guestCanAccessPath, isGuestRole } from "@/lib/auth/guest";
import {
  isInquiryPublicPage,
  isSessionlessInquiryRequest,
} from "@/lib/supabase/inquiry-paths";

export async function updateSession(request: NextRequest) {
  // Cron routes authenticate via CRON_SECRET, never a user session — skip auth MW.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  {
    const p = request.nextUrl.pathname;
    const m = request.method;
    if (
      // Public per-staff calendar subscription feed (token in the URL is the key).
      (p.startsWith("/api/calendar/feed/") && m === "GET") ||
      // LRE AV Terminal Mode API (Bearer avk_live_… validated in the route).
      (p.startsWith("/api/av/terminal/") &&
        (m === "GET" || m === "POST" || m === "PATCH" || m === "DELETE")) ||
      // Twilio inbound SMS webhook + delivery status callback: no Supabase
      // session; auth is the Twilio request signature, validated in the route.
      (p === "/api/sms/webhook" && m === "POST") ||
      (p === "/api/sms/status" && m === "POST") ||
      // Zapier → HoneyBook CRM mirror (shared-secret auth in the route).
      (p === "/api/webhooks/honeybook" && m === "POST") ||
      // Stripe Venue Quotes Book Now deposit (signature verified in the route).
      (p === "/api/webhooks/stripe" && m === "POST") ||
      // AV Show Control phone / Stream Deck remote (PIN / control token auth).
      // Session create stays behind normal staff auth.
      ((p === "/api/av-show/poll" ||
        p === "/api/av-show/cmd" ||
        p === "/api/av-show/state" ||
        p === "/api/av-show/extend") &&
        (m === "GET" || m === "POST")) ||
      // Inquiry Forms: website visitors POST to /api/inquire/* with a submission
      // token in the body (checked in each route), and website pages load the
      // /inquire/embed.js script. No Supabase session. The admin draft preview
      // API (/api/inquire/preview/*) stays on normal auth.
      isSessionlessInquiryRequest(p, m)
    ) {
      return supabaseResponse;
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow the app to boot before env vars are configured
  if (!supabaseUrl || !supabaseAnonKey) {
    const { pathname } = request.nextUrl;
    const allowed =
      pathname === "/login" ||
      pathname === "/guest" ||
      pathname === "/apply" ||
      pathname.startsWith("/apply/") ||
      pathname.startsWith("/quote/") ||
      pathname.startsWith("/portal/") ||
      pathname.startsWith("/estimate/") ||
      pathname.startsWith("/change-order/") ||
      pathname.startsWith("/invoice/") ||
      pathname.startsWith("/project/") ||
      pathname.startsWith("/floorplan/") ||
      pathname.startsWith("/book/") ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/sign/") ||
      pathname === "/av-show/remote" ||
      pathname.startsWith("/av-show/remote/") ||
      isInquiryPublicPage(pathname) ||
      pathname === "/privacy" ||
      pathname === "/speaker-guide" ||
      pathname === "/led-wall-guide" ||
      pathname === "/led-wall-guide-logo.png" ||
      pathname === "/lre-speaker-av-guide.pdf" ||
      pathname === "/sms-terms" ||
      pathname.startsWith("/auth") ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password" ||
      pathname === "/set-password";
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname === "/guest" ||
    pathname === "/apply" ||
    pathname.startsWith("/apply/") ||
    pathname.startsWith("/quote/") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/estimate/") ||
    pathname.startsWith("/change-order/") ||
    pathname.startsWith("/invoice/") ||
    pathname.startsWith("/project/") ||
    pathname.startsWith("/floorplan/") ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/sign/") ||
    pathname === "/av-show/remote" ||
    pathname.startsWith("/av-show/remote/") ||
    // Inquiry Forms public form pages (and the /inquire/embed.js loader).
    isInquiryPublicPage(pathname) ||
    pathname === "/privacy" ||
    pathname === "/speaker-guide" ||
    pathname === "/led-wall-guide" ||
    pathname === "/led-wall-guide-logo.png" ||
    pathname === "/lre-speaker-av-guide.pdf" ||
    pathname === "/sms-terms" ||
    pathname.startsWith("/auth") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/set-password";

  // Invite-only: nothing is visible when logged out
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (pathname === "/login" ||
      pathname === "/guest" ||
      pathname === "/forgot-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && !isAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (isGuestRole(profile?.role) && !guestCanAccessPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
