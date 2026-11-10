import "server-only";

import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { STANDARD_CONTRACT_TEMPLATES } from "./standard-templates";

/** Makes sure the three standard LRE contracts exist. Only adds missing ones; never overwrites edits. */
export async function ensureStandardContractTemplates(): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    const db = createServiceClient();
    const names = STANDARD_CONTRACT_TEMPLATES.map((t) => t.name);
    const { data } = await db.from("contract_templates").select("name").in("name", names);
    const have = new Set((data ?? []).map((r) => String(r.name)));
    const missing = STANDARD_CONTRACT_TEMPLATES.filter((t) => !have.has(t.name));
    if (missing.length) await db.from("contract_templates").insert(missing.map((t) => ({ name: t.name, body: t.body })));
  } catch {
    /* best-effort: the contract box still works with whatever templates exist */
  }
}
