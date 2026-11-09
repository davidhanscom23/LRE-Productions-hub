import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { normalizeDepartments } from "@/lib/types/database";
import {
  CANDIDATE_STAGES,
  stageLabel,
  type CandidateStage,
} from "@/lib/types/hiring";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  formatMoney,
  type ExpenseCategory,
} from "@/lib/types/expenses";
import { countProjectsByStageLabel } from "@/lib/honeybook/pipeline-board";
import { redirect } from "next/navigation";

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "amber" | "brand";
}) {
  const valueColor =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "brand"
        ? "text-[var(--brand)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BarRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm text-[var(--foreground)]">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full rounded-full bg-[var(--brand)]"
          style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-medium text-[var(--muted)]">
        {count}
      </span>
    </div>
  );
}

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthStart = `${todayKey.slice(0, 7)}-01`;

  const [
    peopleRes,
    expenseRes,
    timeOffRes,
    candidateRes,
    tasksRes,
    hbProjectsRes,
    hbPaymentsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("departments, role, is_active").eq("is_active", true),
    supabase.from("expense_requests").select("amount, status, reimbursed_at, category, expense_date"),
    supabase.from("time_off_requests").select("status, start_date, end_date").eq("status", "approved"),
    supabase.from("candidates").select("stage"),
    supabase.from("action_items").select("status"),
    // Partnerships (migration 177) are not events: keep them out of these counts.
    (async () => {
      const withType = await supabase
        .from("honeybook_projects")
        .select("stage, booked_at, record_type");
      if (!withType.error) return withType;
      return supabase.from("honeybook_projects").select("stage, booked_at");
    })(),
    supabase
      .from("honeybook_payments")
      .select("amount, paid_at")
      .gte("paid_at", monthStart),
  ]);

  // Headcount
  const people = peopleRes.data ?? [];
  const headcount = people.length;
  const deptCounts = new Map<string, number>();
  for (const p of people) {
    for (const d of normalizeDepartments((p as { departments?: unknown }).departments)) {
      deptCounts.set(d, (deptCounts.get(d) ?? 0) + 1);
    }
  }
  const deptRows = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxDept = deptRows.reduce((m, [, c]) => Math.max(m, c), 0);

  // Expenses
  const expenses = (expenseRes.data ?? []) as {
    amount: number | string;
    status: string;
    reimbursed_at: string | null;
    category: ExpenseCategory;
    expense_date: string;
  }[];
  const num = (v: number | string) => Number(v) || 0;
  const pendingExpenses = expenses.filter((e) => e.status === "pending");
  const pendingTotal = pendingExpenses.reduce((s, e) => s + num(e.amount), 0);
  const awaitingReimb = expenses.filter(
    (e) => e.status === "approved" && !e.reimbursed_at,
  );
  const awaitingTotal = awaitingReimb.reduce((s, e) => s + num(e.amount), 0);
  const reimbursedThisMonth = expenses
    .filter((e) => e.reimbursed_at && e.reimbursed_at >= monthStart)
    .reduce((s, e) => s + num(e.amount), 0);

  // Category breakdown (approved or reimbursed, this month by expense_date)
  const catTotals = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    if (e.status !== "denied" && e.expense_date >= monthStart) {
      catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + num(e.amount));
    }
  }

  // Time off (upcoming approved)
  const timeOff = (timeOffRes.data ?? []) as {
    start_date: string;
    end_date: string;
  }[];
  const upcomingTimeOff = timeOff.filter((t) => t.end_date >= todayKey).length;

  // Candidates by stage
  const candidates = (candidateRes.data ?? []) as { stage: CandidateStage }[];
  const stageCounts = new Map<CandidateStage, number>();
  for (const c of candidates) {
    stageCounts.set(c.stage, (stageCounts.get(c.stage) ?? 0) + 1);
  }
  const activeCandidates = candidates.filter(
    (c) => c.stage !== "hired" && c.stage !== "rejected",
  ).length;

  // Tasks
  const openTasks = ((tasksRes.data ?? []) as { status: string }[]).filter(
    (t) => t.status === "open",
  ).length;

  // HoneyBook CRM (optional until migration 111 is applied)
  const hbProjects = (
    (hbProjectsRes.data ?? []) as unknown as {
      stage: string;
      booked_at: string | null;
      record_type?: string | null;
    }[]
  ).filter((p) => p.record_type !== "partnership");
  const hbStageRows = countProjectsByStageLabel(hbProjects);
  const maxHbStage = hbStageRows.reduce((m, [, c]) => Math.max(m, c), 0);
  const hbBooked = hbProjects.filter(
    (p) => /booked/i.test(p.stage) || p.booked_at,
  ).length;
  const hbPaidThisMonth = (
    (hbPaymentsRes.data ?? []) as { amount: number | string }[]
  ).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const honeybookReady = !hbProjectsRes.error;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Reports
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          A snapshot across the team. Admin-only, read-only.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Active staff" value={String(headcount)} />
        <Stat
          label="Pending expenses"
          value={formatMoney(pendingTotal)}
          sub={`${pendingExpenses.length} awaiting review`}
          tone={pendingExpenses.length > 0 ? "amber" : "default"}
        />
        <Stat
          label="Awaiting reimbursement"
          value={formatMoney(awaitingTotal)}
          sub={`${awaitingReimb.length} approved, unpaid`}
        />
        <Stat
          label="Reimbursed this month"
          value={formatMoney(reimbursedThisMonth)}
        />
        <Stat
          label="Upcoming time off"
          value={String(upcomingTimeOff)}
          sub="approved, current or future"
        />
        <Stat
          label="Open tasks"
          value={String(openTasks)}
          sub="in Action Center"
        />
        {honeybookReady ? (
          <>
            <Stat
              label="HoneyBook projects"
              value={String(hbProjects.length)}
              sub={`${hbBooked} booked / with booked date`}
              tone="brand"
            />
            <Stat
              label="HB payments this month"
              value={formatMoney(hbPaidThisMonth)}
              sub="from synced HoneyBook payments"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Headcount by department">
          {deptRows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No departments set.</p>
          ) : (
            <div className="space-y-2">
              {deptRows.map(([dept, count]) => (
                <BarRow key={dept} label={dept} count={count} max={maxDept} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Hiring pipeline">
          {candidates.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No candidates yet.{" "}
              <span className="text-[var(--muted)]">Add some in Hiring.</span>
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[var(--muted)]">
                {activeCandidates} active in pipeline
              </p>
              {CANDIDATE_STAGES.map((s) => (
                <div
                  key={s.value}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[var(--foreground)]">
                    {stageLabel(s.value)}
                  </span>
                  <span className="font-medium text-[var(--muted)]">
                    {stageCounts.get(s.value) ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {honeybookReady ? (
        <Panel title="HoneyBook projects by stage">
          {hbProjects.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No HoneyBook projects synced yet. Connect Zapier on{" "}
              <a
                href="/honeybook"
                className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
              >
                HoneyBook
              </a>
              .
            </p>
          ) : (
            <div className="space-y-2">
              {hbStageRows.map(([stage, count]) => (
                <BarRow
                  key={stage}
                  label={stage}
                  count={count}
                  max={maxHbStage}
                />
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      <Panel title="Expenses this month by category">
        {catTotals.size === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No expenses dated this month yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {EXPENSE_CATEGORIES.filter((c) => (catTotals.get(c.value) ?? 0) > 0).map(
              (c) => (
                <div
                  key={c.value}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[var(--foreground)]">
                    {expenseCategoryLabel(c.value)}
                  </span>
                  <span className="font-medium text-[var(--muted)]">
                    {formatMoney(catTotals.get(c.value) ?? 0)}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
