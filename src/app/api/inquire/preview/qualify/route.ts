import type { NextRequest } from "next/server";
import { crossOriginRejection, errorBody, jsonResponse, readJsonBody } from "@/lib/inquiry-forms/server/http-core";
import { previewQualify } from "@/lib/inquiry-forms/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Inquiry Forms admin dry run ({slug, answers}): runs the real date and location checks against
 * the DRAFT definition and stores nothing. Real admins only (an admin in Staff view still counts).
 */
export async function POST(request: NextRequest) {
  const blocked = crossOriginRejection(request);
  if (blocked) return blocked;
  const body = await readJsonBody(request);
  if (!body.ok) return jsonResponse(body.status, errorBody(body.error));
  const result = await previewQualify({ body: body.value });
  return jsonResponse(result.status, result.body);
}
