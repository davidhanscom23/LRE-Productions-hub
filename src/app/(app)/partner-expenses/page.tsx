import { PartnerExpensesClient } from "@/components/partner-expenses/partner-expenses-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { Partner, PartnerExpense } from "@/lib/partner-expenses/shared";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-semibold">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default async function PartnerExpensesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: partner, error: partnerError } =
    await supabase.rpc("my_lre_partner");

  if (partnerError) {
    return (
      <Panel title="Partner expenses needs a database update">
        Run migration <code>198_partner_expenses.sql</code> in Supabase, then
        refresh.
      </Panel>
    );
  }
  if (partner !== "david" && partner !== "luke") {
    return (
      <Panel title="This page is for the two LRE partners">
        The partner expense ledger is private to David and Luke.
      </Panel>
    );
  }

  const { data: rows, error } = await supabase
    .from("partner_expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <Panel title="Could not load the ledger">
        Try refreshing. If it keeps happening, check Hub health.
      </Panel>
    );
  }

  const list = (rows ?? []) as Record<string, unknown>[];
  const paths = list
    .map((r) => String(r.receipt_path ?? ""))
    .filter((p) => p.length > 0);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage
      .from("partner-receipts")
      .createSignedUrls(paths, 3600);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  const expenses: PartnerExpense[] = list.map((r) => ({
    id: String(r.id),
    paid_by: r.paid_by as Partner,
    amount_cents: Number(r.amount_cents) || 0,
    description: String(r.description ?? ""),
    category: String(r.category ?? "other"),
    expense_date: String(r.expense_date ?? ""),
    note: String(r.note ?? ""),
    receipt_path: String(r.receipt_path ?? ""),
    receipt_name: String(r.receipt_name ?? ""),
    receipt_url: signed.get(String(r.receipt_path ?? "")) ?? null,
    reimbursed_at: (r.reimbursed_at as string | null) ?? null,
    flagged_at: (r.flagged_at as string | null) ?? null,
    flag_note: String(r.flag_note ?? ""),
    voided_at: (r.voided_at as string | null) ?? null,
    void_reason: String(r.void_reason ?? ""),
    created_by: String(r.created_by),
    created_at: String(r.created_at ?? ""),
  }));

  return (
    <PartnerExpensesClient
      me={partner}
      meId={profile.id}
      expenses={expenses}
    />
  );
}
