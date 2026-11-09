import { ExpensesClient } from "@/components/expenses/expenses-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getEventMediaAccessUrl } from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseRequest } from "@/lib/types/expenses";
import { redirect } from "next/navigation";

async function mapRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  r: Record<string, unknown>,
  name?: string,
): Promise<ExpenseRequest> {
  const storagePath = String(r.receipt_storage_path ?? "");
  const storageProvider = String(r.receipt_storage_provider ?? "supabase");
  const receiptUrl = (r.receipt_url as string) ?? "";
  let receiptAccessUrl: string | null = null;

  if (storagePath) {
    const access = await getEventMediaAccessUrl({
      supabase,
      path: storagePath,
      provider:
        storageProvider === "bunny" || storageProvider === "supabase"
          ? storageProvider
          : "supabase",
      expiresIn: 3600,
    });
    receiptAccessUrl = access.url;
  }

  return {
    id: String(r.id),
    user_id: String(r.user_id),
    amount: Number(r.amount) || 0,
    category: (r.category as ExpenseRequest["category"]) ?? "other",
    description: (r.description as string) ?? "",
    expense_date: (r.expense_date as string) ?? "",
    receipt_url: receiptUrl,
    receipt_storage_path: storagePath,
    receipt_storage_provider: storageProvider,
    receipt_file_name: (r.receipt_file_name as string) ?? "",
    receipt_access_url: receiptAccessUrl,
    status: (r.status as ExpenseRequest["status"]) ?? "pending",
    reimbursed_at: (r.reimbursed_at as string) ?? null,
    review_note: (r.review_note as string) ?? "",
    created_at: (r.created_at as string) ?? "",
    ...(name ? { requester_name: name } : {}),
  };
}

export default async function ExpensesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: myRows, error } = await supabase
    .from("expense_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Expenses needs a database update</p>
        <p className="mt-2">
          Run migration <code>056_expenses.sql</code> in Supabase, then refresh.
          ({error.message})
        </p>
      </div>
    );
  }

  const myExpenses = await Promise.all(
    ((myRows ?? []) as Record<string, unknown>[]).map((r) =>
      mapRow(supabase, r),
    ),
  );

  let adminExpenses: ExpenseRequest[] = [];
  if (isAdmin) {
    const { data: allRows } = await supabase
      .from("expense_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const ids = Array.from(
      new Set(
        ((allRows ?? []) as Record<string, unknown>[]).map((r) =>
          String(r.user_id),
        ),
      ),
    );
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map(
      (people ?? []).map((p) => [p.id as string, p.full_name as string]),
    );
    adminExpenses = await Promise.all(
      ((allRows ?? []) as Record<string, unknown>[]).map((r) =>
        mapRow(supabase, r, nameById.get(String(r.user_id)) ?? "Unknown"),
      ),
    );
  }

  return (
    <ExpensesClient
      isAdmin={isAdmin}
      myExpenses={myExpenses}
      adminExpenses={adminExpenses}
    />
  );
}
