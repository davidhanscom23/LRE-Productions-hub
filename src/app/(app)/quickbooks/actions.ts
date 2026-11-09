"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { qbDisconnect } from "@/lib/quickbooks/client";
import { invoicesNeedingSync, syncProjectInvoice, type SyncOutcome } from "@/lib/quickbooks/sync";
import { revalidatePath } from "next/cache";

async function adminOnly(): Promise<string | null> {
  const p = await getCurrentProfile();
  return p?.role === "admin" ? null : "Only admins can use QuickBooks sync.";
}

export async function syncOneInvoice(invoiceId: string): Promise<SyncOutcome | { error: string }> {
  const denied = await adminOnly();
  if (denied) return { error: denied };
  const out = await syncProjectInvoice(invoiceId);
  revalidatePath("/quickbooks");
  return out;
}

export async function syncAllInvoices(): Promise<{ error: string } | { error: null; results: SyncOutcome[] }> {
  const denied = await adminOnly();
  if (denied) return { error: denied };
  const todo = await invoicesNeedingSync(25);
  const results: SyncOutcome[] = [];
  for (const t of todo) results.push(await syncProjectInvoice(t.id));
  revalidatePath("/quickbooks");
  return { error: null, results };
}

export async function disconnectQuickBooks(): Promise<{ error: string | null }> {
  const denied = await adminOnly();
  if (denied) return { error: denied };
  await qbDisconnect();
  revalidatePath("/quickbooks");
  return { error: null };
}
