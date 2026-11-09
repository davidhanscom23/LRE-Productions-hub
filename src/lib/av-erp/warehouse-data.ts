import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  heldByKey,
  isOverdue,
  movementKey,
  productQtyOut,
  remainingToCheckOut,
  stillOutByKey,
  type GearMovementRow,
  type HoldQtyRow,
} from "@/lib/av-erp/warehouse";

export type WarehouseStillOutRow = {
  opportunityId: string;
  reference: string;
  subject: string;
  status: string;
  gearEndsAt: string | null;
  productId: string;
  productName: string;
  productCode: string;
  stillOut: number;
  overdue: boolean;
};

export type WarehouseCheckoutRow = {
  opportunityId: string;
  reference: string;
  subject: string;
  status: string;
  gearStartsAt: string | null;
  gearEndsAt: string | null;
  productId: string;
  productName: string;
  productCode: string;
  heldQty: number;
  stillOut: number;
  remaining: number;
};

export type StockRow = {
  productId: string;
  name: string;
  code: string;
  kind: string;
  qtyOwned: number;
  qtyOut: number;
  qtyFree: number;
};

export async function loadWarehouseBoard(supabase: SupabaseClient): Promise<{
  stillOut: WarehouseStillOutRow[];
  checkoutReady: WarehouseCheckoutRow[];
  overdueCount: number;
  stillOutCount: number;
}> {
  const [movementsRes, holdsRes, oppsRes, productsRes] = await Promise.all([
    supabase
      .from("av_gear_movements")
      .select("opportunity_id, product_id, direction, qty"),
    supabase
      .from("av_holds")
      .select("opportunity_id, product_id, qty"),
    supabase
      .from("av_opportunities")
      .select("id, reference, subject, status, gear_starts_at, gear_ends_at")
      .in("status", ["quotation", "order", "draft"]),
    supabase
      .from("av_products")
      .select("id, name, code")
      .eq("is_active", true),
  ]);

  if (movementsRes.error) throw new Error(movementsRes.error.message);
  if (holdsRes.error) throw new Error(holdsRes.error.message);
  if (oppsRes.error) throw new Error(oppsRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const movements = (movementsRes.data ?? []) as GearMovementRow[];
  const holds = (holdsRes.data ?? []) as HoldQtyRow[];
  const stillMap = stillOutByKey(movements);
  const heldMap = heldByKey(holds);

  const oppById = new Map(
    (oppsRes.data ?? []).map((o) => [o.id as string, o]),
  );
  const productName = new Map(
    (productsRes.data ?? []).map((p) => [p.id as string, p.name as string]),
  );
  const productCode = new Map(
    (productsRes.data ?? []).map((p) => [
      p.id as string,
      ((p.code as string) || "").trim(),
    ]),
  );

  const now = Date.now();
  const stillOut: WarehouseStillOutRow[] = [];
  for (const [key, qty] of stillMap) {
    const [opportunityId, productId] = key.split("::");
    const opp = oppById.get(opportunityId);
    if (!opp) continue;
    const gearEndsAt = (opp.gear_ends_at as string | null) ?? null;
    stillOut.push({
      opportunityId,
      reference: opp.reference as string,
      subject: (opp.subject as string) || "Untitled",
      status: opp.status as string,
      gearEndsAt,
      productId,
      productName: productName.get(productId) ?? "Unknown product",
      productCode: productCode.get(productId) ?? "",
      stillOut: qty,
      overdue: isOverdue(qty, gearEndsAt, now),
    });
  }
  stillOut.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.reference.localeCompare(b.reference);
  });

  const checkoutReady: WarehouseCheckoutRow[] = [];
  for (const [key, heldQty] of heldMap) {
    const [opportunityId, productId] = key.split("::");
    const opp = oppById.get(opportunityId);
    if (!opp) continue;
    const still = stillMap.get(key) ?? 0;
    const remaining = remainingToCheckOut(heldQty, still);
    if (remaining <= 0) continue;
    checkoutReady.push({
      opportunityId,
      reference: opp.reference as string,
      subject: (opp.subject as string) || "Untitled",
      status: opp.status as string,
      gearStartsAt: (opp.gear_starts_at as string | null) ?? null,
      gearEndsAt: (opp.gear_ends_at as string | null) ?? null,
      productId,
      productName: productName.get(productId) ?? "Unknown product",
      productCode: productCode.get(productId) ?? "",
      heldQty,
      stillOut: still,
      remaining,
    });
  }
  checkoutReady.sort((a, b) => a.reference.localeCompare(b.reference));

  return {
    stillOut,
    checkoutReady,
    overdueCount: stillOut.filter((r) => r.overdue).length,
    stillOutCount: stillOut.length,
  };
}

export async function loadStockRows(
  supabase: SupabaseClient,
): Promise<StockRow[]> {
  const [productsRes, movementsRes] = await Promise.all([
    supabase
      .from("av_products")
      .select("id, name, code, kind, qty_owned, is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("av_gear_movements")
      .select("opportunity_id, product_id, direction, qty"),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (movementsRes.error) throw new Error(movementsRes.error.message);

  const movements = (movementsRes.data ?? []) as GearMovementRow[];
  return (productsRes.data ?? [])
    .filter((p) => (p.kind as string) !== "package")
    .map((p) => {
      const owned = Number(p.qty_owned) || 0;
      const out = productQtyOut(movements, p.id as string);
      return {
        productId: p.id as string,
        name: p.name as string,
        code: (p.code as string) || "",
        kind: p.kind as string,
        qtyOwned: owned,
        qtyOut: out,
        qtyFree: Math.max(0, owned - out),
      };
    });
}

export { movementKey };
