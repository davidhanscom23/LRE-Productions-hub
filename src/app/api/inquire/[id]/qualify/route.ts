import type { NextRequest } from "next/server";
import { crossOriginRejection, errorBody, jsonResponse, readJsonBody } from "@/lib/inquiry-forms/server/http-core";
import { qualifySubmission } from "@/lib/inquiry-forms/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Geocoding (Nominatim is spaced 1.1 s apart) and nearby-date lookups can take a few seconds.
export const maxDuration = 30;

/**
 * Inquiry Forms availability check ({token}): the server checks the date and the location of the
 * submission's answers, stores the verdicts and the score, and returns the visitor-safe result.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = crossOriginRejection(request);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return jsonResponse(body.status, errorBody(body.error));
  const result = await qualifySubmission({ submissionId: id, body: body.value });
  return jsonResponse(result.status, result.body);
}
