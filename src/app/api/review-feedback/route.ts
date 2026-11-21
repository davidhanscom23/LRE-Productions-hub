import { NextRequest, NextResponse } from "next/server";
import { notifyAdmins } from "@/lib/notifications/notify";
import {
  isAllowedFeedbackOrigin,
  parsePrivateFeedback,
} from "@/lib/reviews/private-feedback";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (isAllowedFeedbackOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

function reply(
  req: NextRequest,
  status: number,
  body: { ok: boolean; error?: string },
) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

/**
 * Public: private feedback from the review page (review.lreproductions.com),
 * sent when a client taps 1-3 stars. Stored for admins only; admins are notified.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  // A browser always sends Origin on a cross-site POST; refuse other websites.
  if (origin && !isAllowedFeedbackOrigin(origin)) {
    return reply(req, 403, { ok: false, error: "Not allowed." });
  }
  if (!isServiceRoleConfigured()) {
    return reply(req, 503, {
      ok: false,
      error: "Feedback isn’t available right now. Please call us instead.",
    });
  }

  const rawText = await req.text().catch(() => "");
  if (rawText.length > MAX_BODY_BYTES) {
    return reply(req, 413, { ok: false, error: "Please shorten your answer a little." });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = null;
  }

  const parsed = parsePrivateFeedback(body);
  if (!parsed.ok) return reply(req, 400, { ok: false, error: parsed.error });
  // Bots that fill the hidden field get a normal-looking success and nothing is saved.
  if (parsed.spam) return reply(req, 200, { ok: true });

  const { fullName, email, improveAreas, teamHandled, rating } = parsed.value;
  const supabase = createServiceClient();
  const { error } = await supabase.from("private_review_feedback").insert({
    full_name: fullName,
    email,
    improve_areas: improveAreas,
    team_handled: teamHandled,
    rating,
  });
  if (error) {
    return reply(req, 500, {
      ok: false,
      error: "We couldn’t save your feedback. Please try again.",
    });
  }

  try {
    const who = fullName || email;
    const stars = rating ? ` (${rating} star${rating === 1 ? "" : "s"})` : "";
    await notifyAdmins(supabase, {
      kind: "private_feedback",
      title: "New private client feedback",
      body: `${who} left private feedback from the review page${stars}.`,
      href: "/client-reviews#private-feedback",
    });
  } catch {
    // Feedback is saved; the notification is best-effort.
  }

  return reply(req, 200, { ok: true });
}
