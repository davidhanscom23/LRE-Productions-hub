/** Pure helpers for change-order line math and apply planning. */

import { lineTotal } from "@/lib/av-erp/pricing";
import { roundMoney } from "@/lib/av-erp/invoicing";

export type ChangeOrderApplyMode = "add" | "adjust_qty" | "remove";

export type ChangeOrderLineInput = {
  id?: string;
  source_line_id?: string | null;
  product_id?: string | null;
  service_id?: string | null;
  description: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
  sort_order: number;
  text_kind?: "rental" | "sale" | null;
  apply_mode: ChangeOrderApplyMode;
};

/** Customer-facing extended amount for one CO line (add = positive, remove = negative of source). */
export function changeOrderLineDelta(
  line: ChangeOrderLineInput,
  sourceQty?: number,
  sourceUnitPrice?: number,
  sourceDiscountPct?: number,
): number {
  if (line.apply_mode === "add") {
    return lineTotal({
      qty: Number(line.qty) || 0,
      unitPrice: Number(line.unit_price) || 0,
      discountPct: Number(line.discount_pct) || 0,
    });
  }
  if (line.apply_mode === "remove") {
    const qty = sourceQty ?? (Number(line.qty) || 0);
    const unit = sourceUnitPrice ?? (Number(line.unit_price) || 0);
    const disc = sourceDiscountPct ?? (Number(line.discount_pct) || 0);
    return -lineTotal({ qty, unitPrice: unit, discountPct: disc });
  }
  // adjust_qty: delta = newTotal - oldTotal
  const oldQty = sourceQty ?? 0;
  const unit = sourceUnitPrice ?? (Number(line.unit_price) || 0);
  const disc = sourceDiscountPct ?? (Number(line.discount_pct) || 0);
  const oldAmt = lineTotal({ qty: oldQty, unitPrice: unit, discountPct: disc });
  const newAmt = lineTotal({
    qty: Number(line.qty) || 0,
    unitPrice: unit,
    discountPct: disc,
  });
  return roundMoney(newAmt - oldAmt);
}

export function changeOrderAmountDelta(
  lines: ReadonlyArray<ChangeOrderLineInput>,
  sourceById?: Map<
    string,
    { qty: number; unit_price: number; discount_pct: number }
  >,
): number {
  return roundMoney(
    lines.reduce((sum, line) => {
      const src = line.source_line_id
        ? sourceById?.get(line.source_line_id)
        : undefined;
      return (
        sum +
        changeOrderLineDelta(
          line,
          src?.qty,
          src?.unit_price,
          src?.discount_pct,
        )
      );
    }, 0),
  );
}
