import "server-only";

import { allocatePayments } from "@/lib/project-invoices/math";
import { contractSignUrl } from "@/lib/project-contracts/server";
import { projectInvoicePayUrl } from "@/lib/project-invoices/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/stripe/server";
import type { PortalItems } from "./portal";

/**
 * Everything the client can act on for one project. Called only after the project's share
 * token has been verified. Each lookup is independent, so a table that isn't migrated yet
 * just yields an empty section instead of breaking the page.
 */
export async function loadPortalItems(projectId: string): Promise<PortalItems> {
  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [contractRes, invoiceRes, planRes, meetingRes] = await Promise.all([
    db
      .from("project_contracts")
      .select("title, status, sign_token, signed_at")
      .eq("project_id", projectId)
      .in("status", ["sent", "signed", "declined"])
      .order("created_at", { ascending: false }),
    db
      .from("project_invoices")
      .select("number, title, status, total, amount_paid, pay_token, project_invoice_installments(amount, due_at, label, sort_order)")
      .eq("project_id", projectId)
      .in("status", ["sent", "partial", "paid"])
      .order("created_at", { ascending: false }),
    db
      .from("floor_plans")
      .select("name, space_name, share_token")
      .eq("project_id", projectId)
      .eq("is_template", false)
      .eq("status", "published")
      .order("updated_at", { ascending: false }),
    db.from("meeting_types").select("title, slug, duration_min").eq("active", true).order("title"),
  ]);

  return {
    contracts: (contractRes.data ?? []).map((c) => ({
      title: String(c.title),
      status: c.status as "sent" | "signed" | "declined",
      url: contractSignUrl(c.sign_token as string),
      signedAt: (c.signed_at as string | null) ?? null,
    })),
    invoices: (invoiceRes.data ?? []).map((i) => {
      const total = Number(i.total);
      const paid = Number(i.amount_paid);
      const inst = (
        (i.project_invoice_installments ?? []) as { amount: number; due_at: string | null; label: string; sort_order: number }[]
      )
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((x) => ({ label: x.label, amount: Number(x.amount), due_at: x.due_at }));
      const next = allocatePayments(inst, paid, today).find((x) => x.remaining > 0);
      return {
        number: String(i.number),
        title: String(i.title ?? ""),
        status: i.status as "sent" | "partial" | "paid",
        total,
        balance: Math.max(0, Math.round((total - paid) * 100) / 100),
        nextDueAt: next?.due_at ?? null,
        url: projectInvoicePayUrl(i.pay_token as string),
      };
    }),
    floorPlans: (planRes.data ?? []).map((p) => ({
      name: String(p.name),
      spaceName: String(p.space_name ?? ""),
      url: `${siteOrigin()}/floorplan/${p.share_token as string}`,
    })),
    meetings: (meetingRes.data ?? []).map((m) => ({
      title: String(m.title),
      minutes: Number(m.duration_min),
      url: `${siteOrigin()}/book/${m.slug as string}`,
    })),
  };
}
