/**
 * Private feedback from the public review page (review.lreproductions.com).
 * Clients who tap 1-3 stars fill in a short form there; it posts to
 * /api/review-feedback, which stores the answers for admins only.
 */

export type PrivateFeedback = {
  fullName: string;
  email: string;
  improveAreas: string;
  teamHandled: string;
  rating: number | null;
};

export type PrivateFeedbackParse =
  | { ok: true; value: PrivateFeedback; spam: boolean }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME = 160;
const MAX_EMAIL = 254;
const MAX_ANSWER = 4000;

/** The review site and its Vercel preview addresses. */
const ALLOWED_ORIGIN_RE =
  /^https:\/\/(review\.lreproductions\.com|lre-review-site(-[a-z0-9-]+)?\.vercel\.app)$/;

export function isAllowedFeedbackOrigin(origin: string | null): boolean {
  return Boolean(origin && ALLOWED_ORIGIN_RE.test(origin));
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parsePrivateFeedback(body: unknown): PrivateFeedbackParse {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const raw = body as Record<string, unknown>;

  const fullName = text(raw.fullName);
  const email = text(raw.email).toLowerCase();
  const improveAreas = text(raw.improveAreas);
  const teamHandled = text(raw.teamHandled);

  if (!email) return { ok: false, error: "Please enter your email." };
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (fullName.length > MAX_NAME) {
    return { ok: false, error: "That name is too long." };
  }
  if (improveAreas.length > MAX_ANSWER || teamHandled.length > MAX_ANSWER) {
    return { ok: false, error: "Please shorten your answer a little." };
  }

  const ratingNum = Number(raw.rating);
  const rating =
    Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5
      ? ratingNum
      : null;

  // Hidden field real visitors never see or fill in.
  const spam = text(raw.website).length > 0;

  return {
    ok: true,
    value: { fullName, email, improveAreas, teamHandled, rating },
    spam,
  };
}
