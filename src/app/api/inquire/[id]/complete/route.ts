import { after, type NextRequest } from "next/server";
import { crossOriginRejection, errorBody, jsonResponse, readJsonBody } from "@/lib/inquiry-forms/server/http-core";
import { completeSubmission } from "@/lib/inquiry-forms/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Covers a final re-check of a changed date or location, and the after() side effects.
export const maxDuration = 30;

/**
 * Inquiry Forms: send the inquiry ({token, answers of the last step, ending, turnstileToken}).
 * One idempotent flip; a second call answers with the same ending. Only the flipping request runs
 * the side effects (Leads card, staff alert, optional emails, stats), after the response.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = crossOriginRejection(request);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return jsonResponse(body.status, errorBody(body.error));
  const result = await completeSubmission({ submissionId: id, body: body.value, headers: request.headers });
  if (result.afterResponse) after(result.afterResponse);
  return jsonResponse(result.status, result.body);
}
