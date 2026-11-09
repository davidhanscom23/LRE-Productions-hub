import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { syncDriveKnowledgeBase } from "@/lib/kb/drive-sync";

/**
 * Crawl the Hub Google Drive root and index Docs / Sheets / PDF / DOCX
 * into Ask the Hub (`source_type: drive`).
 *
 * Authorize with `Authorization: Bearer $CRON_SECRET` (or `?secret=`).
 * Optional: `?force=1` to re-export unchanged files; `?max=80` file cap.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  const maxRaw = Number(request.nextUrl.searchParams.get("max") ?? "80");
  const maxFiles = Number.isFinite(maxRaw) ? maxRaw : 80;

  const result = await syncDriveKnowledgeBase({ force, maxFiles });

  return NextResponse.json({
    ok: !result.error,
    ran: result.ran,
    listed: result.listed,
    upserted: result.upserted,
    skipped: result.skipped,
    deleted: result.deleted,
    error: result.error,
  });
}
