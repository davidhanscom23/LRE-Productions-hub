import type { NextRequest } from "next/server";
import { crossOriginRejection, errorBody, jsonResponse, readJsonBody } from "@/lib/inquiry-forms/server/http-core";
import { pingSubmission } from "@/lib/inquiry-forms/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inquiry Forms heartbeat: every 45 s while the form is visible, and via navigator.sendBeacon on
 * pagehide / visibilitychange hidden (a text/plain JSON body {token}). Keeps the submission out of
 * the abandonment sweep while the visitor is still there.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = crossOriginRejection(request);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const body = await readJsonBody(request, { allowTextPlain: true });
  if (!body.ok) return jsonResponse(body.status, errorBody(body.error));
  const result = await pingSubmission({ submissionId: id, body: body.value });
  return jsonResponse(result.status, result.body);
}
