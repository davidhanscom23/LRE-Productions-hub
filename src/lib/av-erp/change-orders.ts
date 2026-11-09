import "server-only";

import { randomBytes } from "node:crypto";
import { ESTIMATE_TOKEN_RE } from "@/lib/av-erp/public-estimate";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AvChangeOrder } from "@/lib/av-erp/types";

export function newChangeOrderShareToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function loadChangeOrderByToken(
  token: string,
): Promise<
  | (AvChangeOrder & {
      opportunity_reference: string;
      opportunity_subject: string;
      customer_name: string | null;
    })
  | null
> {
  if (!ESTIMATE_TOKEN_RE.test(token)) return null;
  const supabase = createServiceClient();
  const { data: co, error } = await supabase
    .from("av_change_orders")
    .select(
      "id, opportunity_id, number, subject, summary, amount_delta, status, share_token, share_enabled, response_note, signer_name, responded_at, created_by, created_at, updated_at",
    )
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  if (error || !co) return null;
  if (co.status === "void") return null;

  const { data: opp } = await supabase
    .from("av_opportunities")
    .select("id, reference, subject, customer_id")
    .eq("id", co.opportunity_id)
    .maybeSingle();
  if (!opp) return null;

  let customerName: string | null = null;
  if (opp.customer_id) {
    const { data: customer } = await supabase
      .from("av_customers")
      .select("name")
      .eq("id", opp.customer_id)
      .maybeSingle();
    customerName = customer?.name ?? null;
  }

  return {
    ...(co as AvChangeOrder),
    amount_delta: Number(co.amount_delta) || 0,
    opportunity_reference: opp.reference,
    opportunity_subject: opp.subject,
    customer_name: customerName,
  };
}

/** Apply accepted change-order lines onto the parent quote. */
export async function applyChangeOrderLinesToOpportunity(
  changeOrderId: string,
  opportunityId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  const { data: lines, error } = await supabase
    .from("av_change_order_lines")
    .select(
      "id, source_line_id, product_id, service_id, description, qty, unit_price, discount_pct, sort_order, text_kind, apply_mode",
    )
    .eq("change_order_id", changeOrderId)
    .order("sort_order");
  if (error) {
    if (/av_change_order_lines|relation|does not exist/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Change-order lines need migration 153_av_tax_co_lines_signed.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  const { data: existingLines } = await supabase
    .from("av_opportunity_lines")
    .select("id, sort_order")
    .eq("opportunity_id", opportunityId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let nextSort = Number(existingLines?.[0]?.sort_order) + 1 || 0;

  for (const line of lines ?? []) {
    const mode = String(line.apply_mode || "add");
    if (mode === "add") {
      const { error: insertError } = await supabase
        .from("av_opportunity_lines")
        .insert({
          opportunity_id: opportunityId,
          group_id: null,
          parent_line_id: null,
          product_id: line.product_id,
          service_id: line.service_id,
          description: line.description || "Change order line",
          qty: Number(line.qty) || 0,
          unit_price: Number(line.unit_price) || 0,
          discount_pct: Number(line.discount_pct) || 0,
          sort_order: nextSort++,
          text_kind: line.text_kind,
        });
      if (insertError) return { ok: false, error: insertError.message };
      continue;
    }

    if (!line.source_line_id) continue;

    if (mode === "remove") {
      const { error: delError } = await supabase
        .from("av_opportunity_lines")
        .delete()
        .eq("id", line.source_line_id)
        .eq("opportunity_id", opportunityId);
      if (delError) return { ok: false, error: delError.message };
      continue;
    }

    if (mode === "adjust_qty") {
      const { error: updError } = await supabase
        .from("av_opportunity_lines")
        .update({ qty: Number(line.qty) || 0 })
        .eq("id", line.source_line_id)
        .eq("opportunity_id", opportunityId);
      if (updError) return { ok: false, error: updError.message };
    }
  }

  await supabase.from("av_opportunity_notes").insert({
    opportunity_id: opportunityId,
    body: `Applied change order lines from accepted CO (${changeOrderId.slice(0, 8)}…).`,
    author_id: null,
  });

  return { ok: true };
}

