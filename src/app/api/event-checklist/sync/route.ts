import { NextResponse } from "next/server";
import {
  addManualItemAction,
  recordCheckAction,
  removeManualItemAction,
  setItemSourceAction,
  updateScheduleAction,
} from "@/app/(app)/event-checklist/actions";
import { classify, type OpKind, type SendResult } from "@/lib/event-checklist/offline/ops";

export const dynamic = "force-dynamic";

type Incoming = { seq: number; kind: OpKind; clientId: string; payload: Record<string, unknown> };

/**
 * Replays queued offline operations in order. A stable URL (not a Server Action id) so a queue saved
 * before a deploy still works. Stops at the first transient or sign-in problem so order is kept.
 */
export async function POST(req: Request) {
  let ops: Incoming[];
  try {
    const body = (await req.json()) as { ops?: Incoming[] };
    ops = Array.isArray(body.ops) ? body.ops.slice(0, 100) : [];
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const results: ({ seq: number } & SendResult)[] = [];
  for (const op of ops) {
    let result: SendResult;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = op.payload as any;
      let reply: { ok: boolean; error?: string };
      switch (op.kind) {
        case "check":
          reply = await recordCheckAction({ ...p, clientId: op.clientId });
          break;
        case "addItem":
          reply = await addManualItemAction(p);
          break;
        case "removeItem":
          reply = await removeManualItemAction(p.itemId);
          break;
        case "setSource":
          reply = await setItemSourceAction(p);
          break;
        case "schedule":
          reply = await updateScheduleAction(p);
          break;
        default:
          reply = { ok: false, error: "Unknown action." };
      }
      result = classify(reply);
    } catch (e) {
      result = { status: "transient", error: e instanceof Error ? e.message : "Server error" };
    }
    results.push({ seq: op.seq, ...result });
    if (result.status === "transient" || result.status === "auth") break;
  }
  return NextResponse.json({ results });
}
