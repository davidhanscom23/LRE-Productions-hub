/** Pure helpers for product accessory nesting on quotes. */

/** Child line qty = parent qty × accessory qty per parent unit. */
export function accessoryLineQty(
  parentQty: number,
  accessoryQtyPerParent: number,
): number {
  const parent = Math.max(0, parentQty);
  const per = Math.max(0, accessoryQtyPerParent);
  return Math.round(parent * per * 100) / 100;
}

/** Sum of (accessory qty × child unit price) for one parent unit. */
export function accessoryRollupUnitPrice(
  accessories: Iterable<{ qty: number; unitPrice: number }>,
): number {
  let sum = 0;
  for (const a of accessories) {
    sum += Math.max(0, Number(a.qty) || 0) * Math.max(0, Number(a.unitPrice) || 0);
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Price to use on a quote for a catalog product: listed rental_price when set,
 * otherwise the Comes-with accessory rollup (packages often store $0 on the
 * shell and price via included gear).
 */
export function effectiveProductUnitPrice(
  rentalPrice: number,
  accessoryRollup: number,
): number {
  const listed = Math.max(0, Number(rentalPrice) || 0);
  if (listed > 0) return listed;
  return Math.max(0, Number(accessoryRollup) || 0);
}

/**
 * Catalog packages named "0 - ..." (Audio Package, Tech Table, ...) are priced
 * as the sum of the items inside them. On an estimate the package line is a
 * $0 header and every nested item carries its own editable price, so removing
 * or repricing an item changes the package total.
 */
export function isCumulativePackageName(name: string | null | undefined): boolean {
  return /^\s*0\s*-\s/.test(name ?? "");
}
