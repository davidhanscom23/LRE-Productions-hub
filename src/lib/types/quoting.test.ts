import { describe, expect, it } from "vitest";
import {
  summarizeQuoteLines,
  type QuoteLineItem,
} from "@/lib/types/quoting";

function line(
  partial: Partial<QuoteLineItem> & { label: string },
): QuoteLineItem {
  return {
    id: partial.id ?? "1",
    quote_id: partial.quote_id ?? "q",
    label: partial.label,
    quantity: partial.quantity ?? 1,
    list_unit_price: partial.list_unit_price ?? 0,
    quote_unit_price: partial.quote_unit_price ?? 0,
    sort_order: partial.sort_order ?? 0,
  };
}

describe("summarizeQuoteLines", () => {
  it("does not require approval within 20%", () => {
    const summary = summarizeQuoteLines([
      line({ label: "DJ", list_unit_price: 1000, quote_unit_price: 850 }),
    ]);
    expect(summary.needsApproval).toBe(false);
    expect(summary.lineBreaches).toHaveLength(0);
  });

  it("flags a line decrease over 20%", () => {
    const summary = summarizeQuoteLines([
      line({ label: "DJ", list_unit_price: 1000, quote_unit_price: 700 }),
    ]);
    expect(summary.needsApproval).toBe(true);
    expect(summary.lineBreaches).toHaveLength(1);
    expect(summary.lineBreaches[0]?.decrease_pct).toBeCloseTo(0.3);
  });

  it("flags total decrease over 20%", () => {
    const summary = summarizeQuoteLines([
      line({ label: "DJ", list_unit_price: 1000, quote_unit_price: 700 }),
      line({
        id: "2",
        label: "Lights",
        list_unit_price: 500,
        quote_unit_price: 500,
      }),
    ]);
    // 1200 list → 1200 quoted? 700+500=1200 vs 1500 = 20% exactly — use deeper cut
    const over = summarizeQuoteLines([
      line({ label: "DJ", list_unit_price: 1000, quote_unit_price: 700 }),
      line({
        id: "2",
        label: "Lights",
        list_unit_price: 500,
        quote_unit_price: 400,
      }),
    ]);
    expect(over.listTotal).toBe(1500);
    expect(over.quoteTotal).toBe(1100);
    expect(over.totalDecreasePct).toBeCloseTo(400 / 1500);
    expect(over.needsApproval).toBe(true);
    expect(summary.needsApproval).toBe(true);
  });
});
