import { createClient } from "@/lib/supabase/server";
import {
  expenseCategoryLabel,
  formatMoney,
  type ExpenseCategory,
} from "@/lib/types/expenses";
import type { Profile } from "@/lib/types/database";
import { isPacketOverdue } from "@/lib/event-packets/overdue";
import { HANDBOOK_IS_DRAFT_DEFAULT } from "@/lib/handbook/content";
import {
  canViewStaffHandbook,
  getHandbookDocument,
} from "@/lib/handbook/settings";
import { canAccessStaffing } from "@/lib/staffing/access";
import { canViewTrainingCourse } from "@/lib/training/audience-access";
import { publishedCourseProgress } from "@/lib/training/progress";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ForYouQueueItem = { label: string; sub?: string };

export type ForYouQueueSection = {
  title: string;
  href: string;
  cta: string;
  tone: "amber" | "brand";
  items: ForYouQueueItem[];
  /** When false, section is informational and does not count toward totalActionable. */
  actionable?: boolean;
  /**
   * Persistently dismiss this section when the primary CTA is used
   * (e.g. Hall of Fame for monthly trophies).
   */
  dismissKey?: string | null;
};

export type ForYouQueue = {
  sections: ForYouQueueSection[];
  totalActionable: number;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Canonical personal inbox: approvals, tasks, reviews, acks, polls,
 * overdue packets, handbook, training, onboarding — plus pending own requests.
 *
 * Pass a service-role (or other) Supabase client for cron / batch use —
 * reviews and polls use direct table queries so auth.uid()-based RPCs are not required.
 */
export async function getForYouQueue(
  profile: Profile,
  client?: SupabaseClient,
): Promise<ForYouQueue> {
  const supabase = client ?? (await createClient());
  const usingSessionClient = !client;
  const isAdmin = profile.role === "admin";
  const todayKey = new Date().toISOString().slice(0, 10);
  const uid = profile.id;

  const [
    tasksRes,
    myReviewsRes,
    annRes,
    myAcksRes,
    myTimeOffRes,
    myExpRes,
    pollsRes,
    myVotesRes,
    adminTimeOffRes,
    adminExpRes,
    adminReimburseRes,
    adminMarketingRes,
    packetRowsRes,
    coursesRes,
    completionsRes,
    myOnboardingRes,
  ] = await Promise.all([
    // My open tasks I haven't checked off yet (multi-assignee aware).
    supabase
      .from("action_item_assignees")
      .select("done_at, action:action_items!inner(title, due_date, status)")
      .eq("user_id", uid)
      .is("done_at", null)
      .eq("action.status", "open"),
    // Session: security-definer RPC (staff can't SELECT own rows). Service role: direct.
    usingSessionClient
      ? supabase.rpc("list_my_reviews")
      : supabase
          .from("performance_reviews")
          .select(
            "id, self_status, manager_status, cycle:review_cycles!inner(name, status, created_at)",
          )
          .eq("subject_id", uid),
    supabase
      .from("announcements")
      .select("id, title, expires_at, requires_ack")
      .eq("requires_ack", true),
    supabase.from("announcement_acks").select("announcement_id").eq("user_id", uid),
    supabase
      .from("time_off_requests")
      .select("start_date, end_date, type")
      .eq("user_id", uid)
      .eq("status", "pending"),
    supabase
      .from("expense_requests")
      .select("amount, category")
      .eq("user_id", uid)
      .eq("status", "pending"),
    usingSessionClient
      ? supabase.rpc("list_polls_with_results")
      : supabase
          .from("polls")
          .select("id, question, is_closed")
          .eq("is_closed", false)
          .order("created_at", { ascending: false })
          .limit(20),
    usingSessionClient
      ? Promise.resolve({ data: [] as { poll_id: string }[] })
      : supabase.from("poll_votes").select("poll_id").eq("user_id", uid),
    isAdmin
      ? supabase
          .from("time_off_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase
          .from("expense_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase
          .from("expense_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .is("reimbursed_at", null)
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase
          .from("social_post_drafts")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_approval")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("event_packets")
      .select("id, event_date, client_name, status, completion_optional")
      .eq("assignee_id", uid)
      .neq("status", "completed")
      .eq("completion_optional", false)
      .order("event_date", { ascending: true })
      .limit(50),
    supabase
      .from("training_courses")
      .select("id, title, slug, status, audience")
      .eq("status", "published")
      .order("sort_order", { ascending: true }),
    supabase
      .from("training_lesson_completions")
      .select("lesson_id")
      .eq("user_id", uid),
    supabase
      .from("onboarding_plans")
      .select("id, subject_name, status")
      .eq("profile_id", uid)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const taxYear = new Date().getFullYear();
  const [
    myPayRes,
    adminPayRes,
    adminPayPaidRes,
    my1099Res,
    myW9Res,
    adminQuoteApprovalRes,
    adminPipelineAssignRes,
  ] = await Promise.all([
      supabase
        .from("contractor_payment_requests")
        .select("amount, category")
        .eq("user_id", uid)
        .eq("status", "pending"),
      isAdmin
        ? supabase
            .from("contractor_payment_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        : Promise.resolve({ count: 0, error: null }),
      isAdmin
        ? supabase
            .from("contractor_payment_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved")
            .is("paid_at", null)
        : Promise.resolve({ count: 0, error: null }),
      supabase
        .from("contractor_1099_acknowledgements")
        .select("id")
        .eq("user_id", uid)
        .eq("tax_year", taxYear)
        .maybeSingle(),
      supabase
        .from("contractor_w9_files")
        .select("id")
        .eq("user_id", uid)
        .limit(1),
      isAdmin
        ? supabase
            .from("quote_discount_approvals")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        : Promise.resolve({ count: 0, error: null }),
      isAdmin
        ? supabase
            .from("pipeline_assignment_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        : Promise.resolve({ count: 0, error: null }),
    ]);

  const sections: ForYouQueueSection[] = [];

  const pendingTimeOff = (adminTimeOffRes as { count?: number }).count ?? 0;
  const pendingExpenses = (adminExpRes as { count?: number }).count ?? 0;
  const awaitingReimburse =
    (adminReimburseRes as { count?: number }).count ?? 0;
  const pendingMarketing =
    (adminMarketingRes as { count?: number }).count ?? 0;
  const pendingContractorPay =
    (adminPayRes as { count?: number | null }).count ?? 0;
  const awaitingContractorPaid =
    (adminPayPaidRes as { count?: number | null }).count ?? 0;
  const pendingQuoteApprovals =
    (adminQuoteApprovalRes as { count?: number | null }).count ?? 0;
  const pendingPipelineAssign =
    (adminPipelineAssignRes as { count?: number | null }).count ?? 0;

  if (
    isAdmin &&
    (pendingTimeOff > 0 ||
      pendingExpenses > 0 ||
      awaitingReimburse > 0 ||
      pendingContractorPay > 0 ||
      awaitingContractorPaid > 0 ||
      pendingQuoteApprovals > 0 ||
      pendingMarketing > 0 ||
      pendingPipelineAssign > 0)
  ) {
    const items: ForYouQueueItem[] = [];
    if (pendingTimeOff > 0) {
      items.push({
        label: `${pendingTimeOff} time-off request${pendingTimeOff > 1 ? "s" : ""} to review`,
      });
    }
    if (pendingExpenses > 0) {
      items.push({
        label: `${pendingExpenses} expense${pendingExpenses > 1 ? "s" : ""} to review`,
      });
    }
    if (awaitingReimburse > 0) {
      items.push({
        label: `${awaitingReimburse} approved expense${awaitingReimburse > 1 ? "s" : ""} awaiting reimbursement`,
      });
    }
    if (pendingContractorPay > 0) {
      items.push({
        label: `${pendingContractorPay} contractor payment${pendingContractorPay > 1 ? "s" : ""} to review`,
      });
    }
    if (awaitingContractorPaid > 0) {
      items.push({
        label: `${awaitingContractorPaid} approved contractor payment${awaitingContractorPaid > 1 ? "s" : ""} awaiting paid stamp`,
      });
    }
    if (pendingQuoteApprovals > 0) {
      items.push({
        label: `${pendingQuoteApprovals} quote discount${pendingQuoteApprovals > 1 ? "s" : ""} to approve`,
      });
    }
    if (pendingMarketing > 0) {
      items.push({
        label: `${pendingMarketing} social post${pendingMarketing > 1 ? "s" : ""} awaiting approval`,
      });
    }
    if (pendingPipelineAssign > 0) {
      items.push({
        label: `${pendingPipelineAssign} Pipeline assignment${pendingPipelineAssign > 1 ? "s" : ""} to approve`,
      });
    }
    const counts = [
      { n: pendingMarketing, href: "/marketing?filter=pending" },
      { n: pendingTimeOff, href: "/time-off" },
      { n: pendingExpenses + awaitingReimburse, href: "/expenses" },
      {
        n: pendingContractorPay + awaitingContractorPaid,
        href: "/contractor-pay",
      },
      { n: pendingQuoteApprovals, href: "/quoting" },
      { n: pendingPipelineAssign, href: "/pipeline?tab=projects" },
    ];
    counts.sort((a, b) => b.n - a.n);
    const href = counts[0]?.href ?? "/for-you";
    sections.push({
      title: "Approvals waiting on you",
      href,
      cta: "Review",
      tone: "amber",
      items,
    });
  }

  const taskRows = (tasksRes.data ?? []) as {
    action:
      | { title: string; due_date: string | null }
      | { title: string; due_date: string | null }[]
      | null;
  }[];
  const tasks = taskRows
    .map((r) => (Array.isArray(r.action) ? r.action[0] : r.action))
    .filter((a): a is { title: string; due_date: string | null } => Boolean(a))
    .sort((a, b) =>
      (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"),
    );
  if (tasks.length > 0) {
    sections.push({
      title: "Tasks assigned to you",
      href: "/action-center",
      cta: "Open Action Center",
      tone: "brand",
      items: tasks.slice(0, 8).map((t) => ({
        label: t.title,
        sub: t.due_date
          ? `Due ${fmtDate(t.due_date)}${t.due_date < todayKey ? " · overdue" : ""}`
          : undefined,
      })),
    });
  }

  const myReviews = usingSessionClient
    ? ((myReviewsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        cycle_name: String(r.cycle_name ?? "Review"),
        cycle_status: String(r.cycle_status ?? ""),
        self_status: String(r.self_status ?? ""),
        manager_status: String(r.manager_status ?? ""),
        shared: r.shared === true || r.manager_status === "shared",
      }))
    : (
        (myReviewsRes.data ?? []) as {
          self_status: string;
          manager_status: string;
          cycle:
            | { name: string; status: string }
            | { name: string; status: string }[]
            | null;
        }[]
      ).map((r) => {
        const cycle = Array.isArray(r.cycle) ? r.cycle[0] : r.cycle;
        return {
          cycle_name: cycle?.name ?? "Review",
          cycle_status: cycle?.status ?? "",
          self_status: r.self_status,
          manager_status: r.manager_status,
          shared: r.manager_status === "shared",
        };
      });
  const selfDue = myReviews.filter(
    (r) => r.cycle_status === "open" && r.self_status !== "submitted",
  );
  if (selfDue.length > 0) {
    sections.push({
      title: "Self-assessment to complete",
      href: "/reviews",
      cta: "Open Reviews",
      tone: "brand",
      items: selfDue.map((r) => ({ label: String(r.cycle_name ?? "Review") })),
    });
  }

  const sharedReady = myReviews.filter(
    (r) => r.shared === true || r.manager_status === "shared",
  );
  if (sharedReady.length > 0) {
    sections.push({
      title: "Manager feedback ready",
      href: "/reviews",
      cta: "Open Reviews",
      tone: "brand",
      items: sharedReady.map((r) => ({
        label: String(r.cycle_name ?? "Review"),
        sub: "Shared with you",
      })),
    });
  }

  const ackedSet = new Set(
    ((myAcksRes.data ?? []) as { announcement_id: string }[]).map(
      (a) => a.announcement_id,
    ),
  );
  const toAck = (
    (annRes.data ?? []) as {
      id: string;
      title: string;
      expires_at: string | null;
    }[]
  )
    .filter((a) => !a.expires_at || a.expires_at >= todayKey)
    .filter((a) => !ackedSet.has(a.id));
  if (toAck.length > 0) {
    sections.push({
      title: "Announcements to acknowledge",
      href: "/announcements",
      cta: "Open Announcements",
      tone: "brand",
      items: toAck.slice(0, 8).map((a) => ({ label: a.title })),
    });
  }

  let unvoted: { question: string } | undefined;
  if (usingSessionClient) {
    const polls = (pollsRes.data ?? []) as Record<string, unknown>[];
    const row = polls.find((p) => !p.is_closed && !p.my_option_id);
    if (row) unvoted = { question: String(row.question ?? "Team poll") };
  } else {
    const votedPollIds = new Set(
      ((myVotesRes.data ?? []) as { poll_id: string }[]).map((v) => v.poll_id),
    );
    const openPolls = (pollsRes.data ?? []) as {
      id: string;
      question: string;
      is_closed: boolean;
    }[];
    const row = openPolls.find((p) => !p.is_closed && !votedPollIds.has(p.id));
    if (row) unvoted = { question: row.question };
  }
  if (unvoted) {
    sections.push({
      title: "A poll needs your vote",
      href: "/polls",
      cta: "Vote",
      tone: "brand",
      items: [{ label: String(unvoted.question ?? "Team poll") }],
    });
  }

  const overduePackets = (
    (packetRowsRes.data ?? []) as {
      id: string;
      event_date: string;
      client_name: string | null;
      status: string;
      completion_optional?: boolean | null;
    }[]
  ).filter((row) =>
    isPacketOverdue({
      status: row.status as "needs_completion" | "in_progress" | "completed",
      event_date: String(row.event_date),
      completion_optional: Boolean(row.completion_optional),
    }),
  );
  if (overduePackets.length > 0) {
    sections.push({
      title: "Overdue Event Packets",
      href: "/event-packets",
      cta: "Open Event Packets",
      tone: "amber",
      items: overduePackets.slice(0, 8).map((p) => ({
        label: p.client_name?.trim() || "Event packet",
        sub: `Event ${fmtDate(p.event_date)}`,
      })),
    });
  }

  let canViewHandbook = false;
  let handbookIsDraft = HANDBOOK_IS_DRAFT_DEFAULT;
  if (usingSessionClient) {
    canViewHandbook = await canViewStaffHandbook(isAdmin);
    if (canViewHandbook) {
      const handbook = await getHandbookDocument();
      handbookIsDraft = handbook.isDraft;
    }
  } else {
    if (isAdmin) {
      canViewHandbook = true;
    } else {
      const { data: hb } = await supabase
        .from("staff_handbook")
        .select("is_draft")
        .eq("id", 1)
        .maybeSingle();
      if (!hb) {
        canViewHandbook = !HANDBOOK_IS_DRAFT_DEFAULT;
      } else {
        canViewHandbook = !hb.is_draft;
      }
    }
    if (canViewHandbook) {
      const { data: hb } = await supabase
        .from("staff_handbook")
        .select("is_draft")
        .eq("id", 1)
        .maybeSingle();
      handbookIsDraft = hb ? Boolean(hb.is_draft) : HANDBOOK_IS_DRAFT_DEFAULT;
    }
  }
  if (canViewHandbook && !handbookIsDraft) {
    const { data: acknowledgement } = await supabase
      .from("handbook_acknowledgements")
      .select("id")
      .eq("user_id", uid)
      .eq("handbook_revision", "live")
      .maybeSingle();
    if (!acknowledgement?.id) {
      sections.push({
        title: "Staff Handbook acknowledgement",
        href: "/staff-handbook",
        cta: "Open Handbook",
        tone: "brand",
        items: [{ label: "Read and acknowledge the current handbook" }],
      });
    }
  }

  const courses = (
    (coursesRes.data ?? []) as {
      id: string;
      title: string;
      slug: string;
      audience: string;
    }[]
  ).filter((course) =>
    canViewTrainingCourse(course.audience, {
      role: profile.role,
      departments: profile.departments ?? [],
    }),
  );
  if (courses.length > 0) {
    const { data: lessons } = await supabase
      .from("training_lessons")
      .select("id, course_id")
      .in(
        "course_id",
        courses.map((c) => c.id),
      );
    const completed = new Set(
      ((completionsRes.data ?? []) as { lesson_id: string }[]).map(
        (c) => c.lesson_id,
      ),
    );
    const byCourse = new Map<string, string[]>();
    for (const lesson of lessons ?? []) {
      const list = byCourse.get(lesson.course_id) ?? [];
      list.push(lesson.id);
      byCourse.set(lesson.course_id, list);
    }
    const openCourses = courses
      .map((c) => {
        const ids = byCourse.get(c.id) ?? [];
        if (ids.length === 0) return null;
        const done = ids.filter((id) => completed.has(id)).length;
        const progress = publishedCourseProgress(ids.length, done);
        if (
          progress.status !== "not_started" &&
          progress.status !== "in_progress"
        ) {
          return null;
        }
        return { title: c.title, status: progress.status };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "in_progress" ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });
    if (openCourses.length > 0) {
      sections.push({
        title: "Training to finish",
        href: "/training-portal",
        cta: "Open Training",
        tone: "brand",
        items: openCourses.slice(0, 6).map((c) => ({
          label: c.title,
          sub: c.status === "in_progress" ? "In progress" : "Not started",
        })),
      });
    }
  }

  const myPlan = myOnboardingRes.data as
    | { id: string; subject_name: string; status: string }
    | null;
  if (myPlan?.id) {
    const { data: openItems } = await supabase
      .from("onboarding_items")
      .select("id, label")
      .eq("plan_id", myPlan.id)
      .eq("is_done", false)
      .order("sort_order", { ascending: true })
      .limit(6);
    if ((openItems ?? []).length > 0) {
      sections.push({
        title: "Your onboarding checklist",
        href: "/onboarding",
        cta: "Open Onboarding",
        tone: "brand",
        items: (openItems ?? []).map((item) => ({
          label: String(item.label),
        })),
      });
    }
  }



  const myTO = (myTimeOffRes.data ?? []) as {
    start_date: string;
    end_date: string;
    type: string;
  }[];
  const myEx = (myExpRes.data ?? []) as {
    amount: number | string;
    category: ExpenseCategory;
  }[];
  const myPay = (myPayRes.data ?? []) as {
    amount: number | string;
    category: string;
  }[];
  if (myTO.length > 0 || myEx.length > 0 || myPay.length > 0) {
    const items: ForYouQueueItem[] = [];
    for (const t of myTO) {
      items.push({
        label: `Time off ${fmtDate(t.start_date)}${t.end_date !== t.start_date ? `–${fmtDate(t.end_date)}` : ""}`,
        sub: "Awaiting review",
      });
    }
    for (const e of myEx) {
      items.push({
        label: `${formatMoney(Number(e.amount))} · ${expenseCategoryLabel(e.category)}`,
        sub: "Awaiting review",
      });
    }
    for (const p of myPay) {
      items.push({
        label: `${formatMoney(Number(p.amount))} · contractor pay`,
        sub: "Awaiting review",
      });
    }
    const hrefCounts = [
      { n: myTO.length, href: "/time-off" },
      { n: myEx.length, href: "/expenses" },
      { n: myPay.length, href: "/contractor-pay" },
    ].sort((a, b) => b.n - a.n);
    sections.push({
      title: "Your pending requests",
      href: hrefCounts[0]?.href ?? "/for-you",
      cta: "View",
      tone: "brand",
      items,
      actionable: false,
    });
  }

  // Nudge tax forms only when the person already uses Contractor Pay (has a
  // payment row or a prior W-9) so W-2-only staff aren't spammed.
  const usedContractorPay =
    !myPayRes.error &&
    (((myPayRes.data ?? []) as unknown[]).length > 0 ||
      (!myW9Res.error && ((myW9Res.data ?? []) as unknown[]).length > 0));
  const missing1099 = !my1099Res.error && !my1099Res.data;
  const missingW9 =
    !myW9Res.error && ((myW9Res.data ?? []) as unknown[]).length === 0;
  if (usedContractorPay && (missing1099 || missingW9)) {
    const items: ForYouQueueItem[] = [];
    if (missingW9) {
      items.push({ label: "Upload your W-9", sub: `Tax year ${taxYear}` });
    }
    if (missing1099) {
      items.push({
        label: "Sign the annual 1099 acknowledgment",
        sub: `Tax year ${taxYear}`,
      });
    }
    sections.push({
      title: "Contractor tax forms",
      href: "/contractor-pay",
      cta: "Open Contractor Pay",
      tone: "brand",
      items,
      actionable: true,
    });
  }

  // Monthly trophy congratulations (informational — does not count as actionable)
  try {
    const { getCurrentMonthlyAwards, formatAwardPeriod, AWARD_TYPE_LABEL } =
      await import("@/lib/points/monthly-awards");
    const { isForYouKeyDismissed, monthlyTrophiesDismissKey } = await import(
      "@/lib/for-you/dismissals"
    );
    const current = await getCurrentMonthlyAwards(supabase);
    const mine = current.filter((a) => a.userId === uid);
    if (mine.length > 0) {
      const period = mine[0]?.period;
      const dismissKey = period ? monthlyTrophiesDismissKey(period) : null;
      const dismissed =
        dismissKey != null
          ? await isForYouKeyDismissed(supabase, uid, dismissKey)
          : false;
      if (!dismissed) {
        const labels = mine.map(
          (a) =>
            `${AWARD_TYPE_LABEL[a.awardType]}${period ? ` (${formatAwardPeriod(period)})` : ""}`,
        );
        sections.unshift({
          title: "Monthly trophies",
          href: "/winners",
          cta: "Hall of Fame",
          tone: "brand",
          actionable: false,
          dismissKey,
          items: labels.map((label) => ({
            label: `🏆 You're ${label}!`,
          })),
        });
      }
    }
  } catch {
    // non-critical — table may not exist yet
  }

  // Admins & Leads: AV jobs in the next 14 days with no confirmed crew.
  if (canAccessStaffing(profile.role)) {
    try {
      const { listAvCrewCoverageGaps } = await import(
        "@/lib/staffing/av-demand"
      );
      const gaps = await listAvCrewCoverageGaps(supabase, { days: 14 });
      if (gaps.length > 0) {
        sections.unshift({
          title: "Jobs needing crew",
          href: "/staffing",
          cta: "Open Staffing",
          tone: "amber",
          actionable: true,
          items: gaps.slice(0, 8).map((g) => ({
            label: `${g.reference} · ${g.subject}`,
            sub:
              g.status === "order"
                ? "Order — no confirmed crew"
                : "Quotation — no confirmed crew",
          })),
        });
      }
    } catch {
      // AV tables may be missing; ignore.
    }
  }

  const totalActionable = sections
    .filter((s) => s.actionable !== false)
    .reduce((n, s) => n + s.items.length, 0);

  return { sections, totalActionable };
}
