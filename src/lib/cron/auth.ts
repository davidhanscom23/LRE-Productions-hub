import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Authorize a cron/system route with CRON_SECRET.
 * Accepts `Authorization: Bearer …` (preferred) or `?secret=` (legacy).
 * Fails closed when the secret is unset.
 */
export function authorizeCronRequest(
  request: NextRequest,
): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const querySecret = (request.nextUrl.searchParams.get("secret") ?? "").trim();

  if (safeEqual(bearer, secret) || safeEqual(querySecret, secret)) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
