import { ingestHoneyBookPayload } from "@/lib/honeybook/ingest";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

/**
 * Zapier → Hub HoneyBook webhook.
 *
 * Point a Zapier "Webhooks by Zapier → POST" action here:
 *   https://<host>/api/webhooks/honeybook
 *
 * Auth (pick one):
 *   Authorization: Bearer <HONEYBOOK_WEBHOOK_SECRET>
 *   X-Webhook-Secret: <HONEYBOOK_WEBHOOK_SECRET>
 *   ?secret=<HONEYBOOK_WEBHOOK_SECRET>
 *
 * Body: JSON with `event` plus client / project / payment fields
 * (nested or flat — see Hub → HoneyBook setup tab).
 */
export async function POST(req: Request) {
  const secret = process.env.HONEYBOOK_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { error: "HONEYBOOK_WEBHOOK_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (!isServiceRoleConfigured()) {
    return Response.json(
      { error: "Service role is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const headerSecret = req.headers.get("x-webhook-secret")?.trim() ?? "";
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";
  const provided = bearer || headerSecret || querySecret;
  if (!provided || provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const json = await req.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return Response.json({ error: "Expected a JSON object." }, { status: 400 });
    }
    body = json as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const idemHeader =
    req.headers.get("x-idempotency-key")?.trim() ||
    req.headers.get("x-zapier-delivery-id")?.trim() ||
    null;

  const result = await ingestHoneyBookPayload(body, {
    idempotencyKey: idemHeader,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, status: result.status, message: result.message },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    status: result.status,
    message: result.message,
    clientId: result.clientId ?? null,
    projectId: result.projectId ?? null,
    paymentId: result.paymentId ?? null,
    taskId: result.taskId ?? null,
  });
}
