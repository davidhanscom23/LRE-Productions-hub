import { after, type NextRequest } from "next/server";
import { crossOriginRejection, emptyResponse, readJsonBody } from "@/lib/inquiry-forms/server/http-core";
import { recordView } from "@/lib/inquiry-forms/server/service";
import { clientIpFrom } from "@/lib/inquiry-forms/server/spam-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inquiry Forms page view ({slug}, JSON or a sendBeacon text/plain body). Counted once per
 * visitor per form per 30 minutes. Always answers 204 (nothing to read, nothing to retry).
 */
export async function POST(request: NextRequest) {
  if (crossOriginRejection(request)) return emptyResponse(204);
  const body = await readJsonBody(request, { allowTextPlain: true });
  if (!body.ok) return emptyResponse(204);
  const ip = clientIpFrom(request.headers);
  after(() => recordView({ body: body.value, ip }));
  return emptyResponse(204);
}
