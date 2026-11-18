import Link from "next/link";
import { VerifyAuditButton } from "@/components/partner-expenses/verify-audit-button";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  PARTNER_NAMES,
  auditActionLabel,
  categoryLabel,
  formatCents,
  type Partner,
} from "@/lib/partner-expenses/shared";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuditRow = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_partner: string | null;
  db_role: string;
  action: string;
  expense_id: string | null;
  changed_fields: string[];
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
};

const FIELD_LABELS: Record<string, string> = {
  paid_by: "whose expense",
  amount_cents: "amount",
  description: "description",
  category: "category",
  expense_date: "date",
  note: "note",
  receipt_path: "receipt",
  receipt_name: "receipt name",
  reimbursed_at: "reimbursed",
  reimbursed_by: "reimbursed by",
  flagged_at: "flag",
  flagged_by: "flagged by",
  flag_note: "flag note",
  voided_at: "voided",
  voided_by: "voided by",
  void_reason: "void reason",
};

function showValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (field === "amount_cents") return formatCents(Number(value));
  if (field === "paid_by") return PARTNER_NAMES[value as Partner] ?? String(value);
  if (field === "category") return categoryLabel(String(value));
  if (field.endsWith("_by")) return "a partner";
  if (field.endsWith("_at")) return "yes";
  if (field === "receipt_path") return "a file";
  return String(value);
}

function describeChange(row: AuditRow): string[] {
  if (row.action === "created") {
    const a = row.after_data ?? {};
    return [
      `${formatCents(Number(a.amount_cents) || 0)} · ${String(a.description ?? "")} · for ${PARTNER_NAMES[a.paid_by as Partner] ?? ""}`,
    ];
  }
  if (row.action.startsWith("roster_")) {
    return ["The list of partners allowed to use this ledger changed."];
  }
  const skip = new Set(["flagged_by", "reimbursed_by", "voided_by", "receipt_name"]);
  return row.changed_fields
    .filter((f) => !skip.has(f))
    .map((f) => {
      const label = FIELD_LABELS[f] ?? f;
      return `${label}: ${showValue(f, row.before_data?.[f])} → ${showValue(f, row.after_data?.[f])}`;
    });
}

export default async function PartnerExpensesActivityPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: partner, error: partnerError } =
    await supabase.rpc("my_lre_partner");
  if (partnerError || (partner !== "david" && partner !== "luke")) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        This page is for the two LRE partners.
      </div>
    );
  }

  const [{ data: rows }, { data: expenses }] = await Promise.all([
    supabase
      .from("partner_expense_audit")
      .select("id, at, actor_id, actor_partner, db_role, action, expense_id, changed_fields, before_data, after_data")
      .order("id", { ascending: false })
      .limit(300),
    supabase.from("partner_expenses").select("id, description"),
  ]);
  const names = new Map(
    (expenses ?? []).map((e) => [e.id as string, String(e.description ?? "")]),
  );
  const log = (rows ?? []) as AuditRow[];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <Link href="/partner-expenses" className="text-sm underline">
          ← Back to partner expenses
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[var(--foreground)]">Activity log</h1>
        <p className="text-sm text-[var(--muted)]">
          Every add, edit, void, reimbursement, flag and receipt change, with who did it and when.
          Nobody can edit or delete this log, and each entry is sealed to the one before it.
        </p>
      </header>

      <VerifyAuditButton />

      {log.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          Nothing has happened yet.
        </p>
      ) : (
        <ol className="space-y-2">
          {log.map((r) => {
            const lines = describeChange(r);
            const outside = !r.actor_id;
            return (
              <li key={r.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="font-semibold text-[var(--foreground)]">
                    {outside
                      ? "Changed outside the app"
                      : PARTNER_NAMES[r.actor_partner as Partner] ?? "A partner"}
                    {" · "}
                    {auditActionLabel(r.action)}
                  </p>
                  <time className="text-xs text-[var(--muted)]" dateTime={r.at}>
                    {new Date(r.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {r.expense_id && names.get(r.expense_id) ? (
                  <p className="text-sm text-[var(--foreground)]">{names.get(r.expense_id)}</p>
                ) : null}
                {lines.map((l, i) => (
                  <p key={i} className="break-words text-sm text-[var(--muted)]">{l}</p>
                ))}
                {outside ? (
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                    Made directly in the database by &quot;{r.db_role}&quot;, not through the Hub.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
