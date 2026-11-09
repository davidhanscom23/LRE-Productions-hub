import type { NextRequest } from "next/server";
import { crossOriginRejection, errorBody, jsonResponse, readJsonBody } from "@/lib/inquiry-forms/server/http-core";
import { saveStep } from "@/lib/inquiry-forms/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inquiry Forms: save one step's answers ({token, stepIndex, answers}). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = crossOriginRejection(request);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return jsonResponse(body.status, errorBody(body.error));
  const result = await saveStep({ submissionId: id, body: body.value });
  return jsonResponse(result.status, result.body);
}
