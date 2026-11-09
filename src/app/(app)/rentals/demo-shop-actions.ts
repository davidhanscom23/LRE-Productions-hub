"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import { clearDemoShop, loadDemoShop } from "@/lib/av-erp/demo-shop";

export type DemoShopActionResult =
  | { ok: true; message: string; alreadyLoaded: boolean }
  | { ok: false; error: string };

function revalidateDemoShopPaths() {
  revalidatePath("/rentals");
  revalidatePath("/rentals/quotes");
  revalidatePath("/rentals/invoices");
  revalidatePath("/rentals/catalog");
  revalidatePath("/rentals/customers");
  revalidatePath("/rentals/venues");
  revalidatePath("/rentals/warehouse");
  revalidatePath("/rentals/stock");
  revalidatePath("/rentals/activities");
  revalidatePath("/rentals/suppliers");
  revalidatePath("/rentals/reports");
  revalidatePath("/rentals/calendar");
  revalidatePath("/rentals/planner");
  revalidatePath("/rentals/travel");
  revalidatePath("/rentals/costs");
}

export async function loadDemoShopAction(): Promise<DemoShopActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const result = await loadDemoShop(supabase, profile.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidateDemoShopPaths();

  return {
    ok: true,
    message: result.message,
    alreadyLoaded: result.alreadyLoaded,
  };
}

export async function clearDemoShopAction(): Promise<DemoShopActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const result = await clearDemoShop(supabase);
  if (!result.ok) return { ok: false, error: result.error };

  revalidateDemoShopPaths();

  return {
    ok: true,
    message: result.message,
    alreadyLoaded: false,
  };
}
