"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import {
  createIntegrationToken,
  revokeIntegrationToken,
  type AvTokenScope,
} from "@/lib/av-erp/terminal-tokens";

export type DeveloperActionState = {
  ok: boolean;
  error?: string;
  plaintext?: string;
  label?: string;
};

export async function createAvApiKeyAction(
  _prev: DeveloperActionState,
  formData: FormData,
): Promise<DeveloperActionState> {
  try {
    const { supabase, profile, error } = await requireAvErpAccess();
    if (error || !profile) {
      return { ok: false, error: error ?? "Access denied" };
    }
    const label = String(formData.get("label") ?? "");
    const allowWrite = formData.get("write") === "on";
    const scopes: AvTokenScope[] = allowWrite ? ["read", "write"] : ["read"];
    const { row, plaintext } = await createIntegrationToken(supabase, {
      label,
      scopes,
      createdBy: profile.id,
    });
    revalidatePath("/rentals/developer");
    return { ok: true, plaintext, label: row.label };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create key",
    };
  }
}

/** Plain form action — must return void (not useActionState). */
export async function revokeAvApiKeyAction(formData: FormData): Promise<void> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) throw new Error(error);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing key id");
  await revokeIntegrationToken(supabase, id);
  revalidatePath("/rentals/developer");
}
