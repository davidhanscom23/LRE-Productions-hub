import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { runPipelineAutomations } from "@/lib/pipeline/automations-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily: sends the Pipeline client emails that an admin has switched on. */
async function handle(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;
  const summary = await runPipelineAutomations();
  return NextResponse.json({ ...summary, due: summary.due.length }, { status: summary.ok ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
