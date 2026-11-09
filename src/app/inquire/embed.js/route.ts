import { hubAdapter } from "@/lib/inquiry-forms/server/adapter";
import { buildEmbedScript } from "@/components/inquiry-forms/public/embed-script";

/**
 * GET /inquire/embed.js - the hosted embed script (the ONLY snippet handed to site owners).
 * The canonical hub origin is baked in as the last-resort origin; the container's
 * data-inquiry-form-origin and the script's own src win over it (see embed-script.ts).
 * Cached 5 minutes so a fix reaches every host page quickly.
 */
export async function GET() {
  let origin = "";
  try {
    origin = hubAdapter.publicOrigin();
  } catch {
    // No configured origin: the script still works from data-inquiry-form-origin or its own src.
    origin = "";
  }
  return new Response(buildEmbedScript(origin), {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
