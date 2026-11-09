import type { NextRequest } from "next/server";
import { crossOriginRejection, errorBody, jsonResponse, readJsonBody } from "@/lib/inquiry-forms/server/http-core";
import { startSubmission } from "@/lib/inquiry-forms/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inquiry Forms: the visitor finished step 1 (contact first). Creates the submission and returns
 * {submissionId, token}. Spam gets a normal-looking token and is stored with stage "spam".
 */
export async function POST(request: NextRequest) {
  const blocked = crossOriginRejection(request);
  if (blocked) return blocked;
  const body = await readJsonBody(request);
  if (!body.ok) return jsonResponse(body.status, errorBody(body.error));
  const result = await startSubmission({ body: body.value, headers: request.headers });
  return jsonResponse(result.status, result.body);
}
