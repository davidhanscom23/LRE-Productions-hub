import Link from "next/link";
import { HolidayPreviewCard } from "@/components/holidays/holiday-preview-card";
import { getHolidayPreview } from "@/lib/holidays/holiday-preview";
import { PointsActivityPrivacyCard } from "@/components/points/points-activity-privacy-card";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isSharedCalendarConfigured } from "@/lib/calendar/settings";
import { inspectDriveConnection } from "@/lib/drive/client";
import { isReviewsSheetConfiguredAsync } from "@/lib/reviews/sync-sheet";
import { resolveReviewsSpreadsheetId } from "@/lib/reviews/ensure-sheet";
import { isEmailConfigured } from "@/lib/email/send";
import {
  isAnySocialApiConfigured,
  apiPublishablePlatforms,
} from "@/lib/social/publishable-platforms";
import { getYouTubeCredentialStatus } from "@/lib/social/youtube-publish";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import { isHiggsfieldConfigured } from "@/lib/higgsfield/credentials";
import { isBunnyConfigured } from "@/lib/storage/event-media";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/social/platforms";
import { redirect } from "next/navigation";

type CheckStatus = "ok" | "warn" | "missing";

type CheckItem = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  href?: string;
  hrefLabel?: string;
};

function statusClass(status: CheckStatus): string {
  if (status === "ok") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
  if (status === "warn") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
}

function statusLabel(status: CheckStatus): string {
  if (status === "ok") return "Ready";
  if (status === "warn") return "Check";
  return "Missing";
}

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export default async function HubHealthPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const holidayPreview = await getHolidayPreview();
  const companyIcal = await isSharedCalendarConfigured();
  const driveInfo = await inspectDriveConnection();
  // Inquiry Forms: public intake and the sweep run on the service role, so probe
  // with it when it is set (the form count is then real).
  const inquiryProbeUsesServiceRole = isServiceRoleConfigured();

  const [
    quizTable,
    expenseReceiptCols,
    onboardingCandidateCol,
    managerFn,
    hiringApps,
    avCore,
    avInvoices,
    avCosts,
    avCredits,
    avCrewRollup,
    avTokens,
    avVenuePlan,
    avKmGaps,
    avGuide,
    inquiryFormsTable,
  ] = await Promise.all([
    supabase.from("training_questions").select("id", { count: "exact", head: true }),
    supabase
      .from("expense_requests")
      .select("receipt_storage_path")
      .limit(1),
    supabase.from("onboarding_plans").select("candidate_id").limit(1),
    supabase.rpc("is_manager_of", { p_subject: profile.id }),
    supabase.from("hiring_applications").select("id", { count: "exact", head: true }),
    supabase.from("av_opportunities").select("id", { count: "exact", head: true }),
    supabase.from("av_invoices").select("id", { count: "exact", head: true }),
    supabase.from("av_job_costs").select("id", { count: "exact", head: true }),
    supabase.from("av_invoice_credits").select("id", { count: "exact", head: true }),
    supabase.from("av_job_costs").select("booking_id").limit(1),
    supabase.from("av_integration_tokens").select("id", { count: "exact", head: true }),
    supabase.from("av_opportunity_attachments").select("id", { count: "exact", head: true }),
    supabase.from("av_contractors").select("id", { count: "exact", head: true }),
    supabase
      .from("kb_documents")
      .select("content")
      .eq("source_type", "hub_guide")
      .eq("source_id", "vident-av")
      .maybeSingle(),
    // draft_saved_at is part of 167: a missing column reads as "not applied".
    inquiryProbeUsesServiceRole
      ? createServiceClient()
          .from("inquiry_forms")
          .select("id, draft_saved_at", { count: "exact", head: true })
      : supabase
          .from("inquiry_forms")
          .select("id, draft_saved_at", { count: "exact", head: true }),
  ]);

  const quizOk = !quizTable.error;
  const expenseReceiptOk = !expenseReceiptCols.error;
  const onboardingHireOk = !onboardingCandidateCol.error;
  const subjectAccessOk = !managerFn.error;
  const hiringAppsOk = !hiringApps.error;
  const avCoreOk = !avCore.error;
  const avInvoicesOk = !avInvoices.error;
  const avCostsOk = !avCosts.error;
  const avCreditsOk = !avCredits.error;
  const avCrewRollupOk = !avCrewRollup.error;
  const avTokensOk = !avTokens.error;
  const avVenuePlanOk = !avVenuePlan.error;
  const avKmGapsOk = !avKmGaps.error;
  const inquiryFormsOk = !inquiryFormsTable.error;
  const inquiryFormCount =
    inquiryFormsOk && inquiryProbeUsesServiceRole
      ? (inquiryFormsTable.count ?? 0)
      : null;
  const avGuideContent = String(avGuide.data?.content ?? "");
  const avGuideFresh =
    avGuideContent.includes("Reports (Phase 4+)") &&
    avGuideContent.includes("Import tab retired") &&
    avGuideContent.includes("credit notes") &&
    avGuideContent.includes("labor cost") &&
    avGuideContent.includes("Developer and API") &&
    avGuideContent.includes("Venue plan") &&
    avGuideContent.includes("text_kind") &&
    avGuideContent.includes("accept–decline");
  const currentRmsEnvLeft =
    envPresent("CURRENT_RMS_SUBDOMAIN") || envPresent("CURRENT_RMS_API_KEY");

  const apiPlatforms = apiPublishablePlatforms();
  const socialConfigured = isAnySocialApiConfigured();
  const cronSecret = envPresent("CRON_SECRET");
  const serviceRole = envPresent("SUPABASE_SERVICE_ROLE_KEY");
  const openai = envPresent("OPENAI_API_KEY");
  const geminiConfigured = isGeminiConfigured();
  const higgsfieldConfigured = isHiggsfieldConfigured();
  const reviewsSheet = await isReviewsSheetConfiguredAsync(supabase);
  const reviewsSpreadsheetId = await resolveReviewsSpreadsheetId(supabase);
  const bunny = isBunnyConfigured();
  const emailConfigured = isEmailConfigured();
  const youtubeCreds = getYouTubeCredentialStatus();
  const mediaProvider =
    process.env.EVENT_MEDIA_STORAGE_PROVIDER?.trim().toLowerCase() === "bunny"
      ? "bunny"
      : "supabase";

  const driveStatus: CheckStatus = !driveInfo.configured
    ? "warn"
    : driveInfo.error
      ? "missing"
      : "ok";
  const driveDetail = !driveInfo.configured
    ? "Optional: set GOOGLE_SERVICE_ACCOUNT_EMAIL, PRIVATE_KEY, and GOOGLE_DRIVE_ROOT_FOLDER_ID — or paste the folder URL on /drive."
    : driveInfo.error
      ? `Configured but unreachable: ${driveInfo.error}`
      : `Connected to “${driveInfo.folderName ?? "folder"}” (${
          driveInfo.rootFolderSource === "app_settings"
            ? "Hub override"
            : driveInfo.rootFolderSource === "default"
              ? "LRE default"
              : "env"
        })${driveInfo.clientEmail ? ` via ${driveInfo.clientEmail}` : ""}.`;

  const youtubeStatus: CheckStatus =
    youtubeCreds.status === "ready_refresh"
      ? "ok"
      : youtubeCreds.status === "ready_access_token"
        ? "warn"
        : youtubeCreds.status === "partial"
          ? "warn"
          : "missing";

  const checks: CheckItem[] = [
    {
      id: "ical",
      label: "Pipeline calendar feed",
      status: companyIcal ? "ok" : "missing",
      detail: companyIcal
        ? "Shared Pipeline Google Calendar iCal is saved (URL hidden)."
        : "Paste the Pipeline Google Calendar secret iCal URL on Calendar so Event Packets and My Week can sync.",
      href: "/calendar",
      hrefLabel: "Open Calendar",
    },
    {
      id: "cron",
      label: "Cron + service role",
      status: cronSecret && serviceRole ? "ok" : "warn",
      detail:
        cronSecret && serviceRole
          ? "CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY are set for packet sync / overdue / auto-publish jobs."
          : "Set CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY so Vercel crons can sync packets and auto-publish.",
    },
    {
      id: "openai",
      label: "Ask the Hub / captions (OpenAI)",
      status: openai ? "ok" : "warn",
      detail: openai
        ? "OPENAI_API_KEY is set."
        : "OPENAI_API_KEY is missing — Ask the Hub and Social Studio captions need it.",
      href: "/ask",
      hrefLabel: "Ask the Hub",
    },
    {
      id: "image-gen",
      label: "Image generation (Gemini / Higgsfield)",
      status:
        geminiConfigured || higgsfieldConfigured
          ? geminiConfigured
            ? "ok"
            : "warn"
          : "missing",
      detail: geminiConfigured
        ? higgsfieldConfigured
          ? "GEMINI_API_KEY is set (Nano Banana Pro). Higgsfield HF_API_KEY + HF_API_SECRET also set for fallbacks."
          : "GEMINI_API_KEY is set (Nano Banana Pro). Optional: add HF_API_KEY + HF_API_SECRET for Soul/FLUX fallbacks."
        : higgsfieldConfigured
          ? "Higgsfield is set, but GEMINI_API_KEY is missing — Nano Banana Pro will fall back to Soul Standard."
          : "Set GEMINI_API_KEY (Google AI Studio) and/or HF_API_KEY + HF_API_SECRET in Vercel, then redeploy. Powers Social Studio Generate image and Image Studio.",
      href: "/image-studio",
      hrefLabel: "Image Studio",
    },
    {
      id: "social",
      label: "Social API publish",
      status: socialConfigured ? "ok" : "warn",
      detail: socialConfigured
        ? `API publish ready for: ${apiPlatforms
            .map((p) => SOCIAL_PLATFORM_LABELS[p])
            .join(", ") || "configured credentials (see Marketing Queue)"}.`
        : "No Meta / Post for Me (LinkedIn/TikTok/Threads/Pinterest) / X / YouTube credentials detected. Queue still works with Mark posted / approval.",
      href: "/marketing",
      hrefLabel: "Marketing Queue",
    },
    {
      id: "youtube",
      label: "YouTube publish credentials",
      status: youtubeStatus,
      detail: youtubeCreds.detail,
      href: "/marketing",
      hrefLabel: "Marketing Queue",
    },
    {
      id: "email",
      label: "Resend / transactional email",
      status: emailConfigured ? "ok" : "warn",
      detail: emailConfigured
        ? "RESEND_API_KEY and EMAIL_FROM are set (Field digest, hire invites, expense/time-off notices)."
        : "RESEND_API_KEY and/or EMAIL_FROM missing — Hub emails are skipped. In-app notifications still work.",
    },
    {
      id: "drive",
      label: "Google Drive backup",
      status: driveStatus,
      detail: driveDetail,
      href: "/drive",
      hrefLabel: "Open Drive",
    },
    {
      id: "reviews-sheet",
      label: "Website reviews sheet",
      status: reviewsSheet ? "ok" : "warn",
      detail: reviewsSheet
        ? `LRE reviews sheet is linked${
            reviewsSpreadsheetId ? ` (${reviewsSpreadsheetId})` : ""
          }.`
        : "Not linked. Set GOOGLE_SHEETS_REVIEWS_CSV_URL or GOOGLE_SHEETS_REVIEWS_SPREADSHEET_ID (share the sheet with the service account).",
      href: "/client-reviews",
      hrefLabel: "Client Reviews",
    },
    {
      id: "media",
      label: "Event media storage",
      status:
        mediaProvider === "bunny" && !bunny ? "missing" : "ok",
      detail:
        mediaProvider === "bunny"
          ? bunny
            ? "EVENT_MEDIA_STORAGE_PROVIDER=bunny and Bunny env vars look set."
            : "Bunny selected but BUNNY_STORAGE_ZONE / API key / CDN host are incomplete."
          : "Using Supabase Storage bucket event-media (default).",
    },
    {
      id: "quiz-migration",
      label: "Training quizzes (migration 064)",
      status: quizOk ? "ok" : "missing",
      detail: quizOk
        ? "training_questions table is available (064 applied)."
        : `Run supabase/migrations/064_training_quizzes.sql in the Supabase SQL editor. (${quizTable.error?.message ?? "table missing"})`,
      href: "/training-portal",
      hrefLabel: "Training Portal",
    },
    {
      id: "expense-migration",
      label: "Expense receipts + hire→onboarding (065)",
      status: expenseReceiptOk && onboardingHireOk ? "ok" : "missing",
      detail:
        expenseReceiptOk && onboardingHireOk
          ? "Receipt storage columns and onboarding.candidate_id are available (065 applied)."
          : `Run supabase/migrations/065_expense_receipts_onboarding_hire.sql. (${
              expenseReceiptCols.error?.message ||
              onboardingCandidateCol.error?.message ||
              "columns missing"
            })`,
      href: "/expenses",
      hrefLabel: "Expenses",
    },
    {
      id: "subject-access-migration",
      label: "Onboarding subject + review managers (066)",
      status: subjectAccessOk ? "ok" : "missing",
      detail: subjectAccessOk
        ? "is_manager_of / subject onboarding access is available (066 applied)."
        : `Run supabase/migrations/066_onboarding_subject_reviews_managers.sql. (${managerFn.error?.message ?? "RPC missing"})`,
      href: "/onboarding",
      hrefLabel: "Onboarding",
    },
    {
      id: "hiring-apps-migration",
      label: "Public hiring applications (067)",
      status: hiringAppsOk ? "ok" : "warn",
      detail: hiringAppsOk
        ? "hiring_applications table is available (067 applied). Public form: /apply."
        : `Optional: run supabase/migrations/067_hiring_applications.sql for /apply intake. (${
            hiringApps.error?.message ?? "table missing"
          })`,
      href: "/hiring",
      hrefLabel: "Hiring",
    },
    {
      id: "av-erp-core",
      label: "LRE AV core (migration 140+)",
      status: avCoreOk ? "ok" : "missing",
      detail: avCoreOk
        ? "av_opportunities is available (AV ERP core applied)."
        : `Run supabase/migrations/140_av_erp_core.sql (and later AV migrations) in Supabase SQL Editor. (${
            avCore.error?.message ?? "table missing"
          })`,
      href: "/rentals",
      hrefLabel: "LRE AV",
    },
    {
      id: "av-erp-invoices",
      label: "LRE AV invoices (migration 144)",
      status: avInvoicesOk ? "ok" : "missing",
      detail: avInvoicesOk
        ? "av_invoices is available (144 applied)."
        : `Run supabase/migrations/144_av_invoices.sql in Supabase SQL Editor. (${
            avInvoices.error?.message ?? "table missing"
          })`,
      href: "/rentals/invoices",
      hrefLabel: "AV Invoices",
    },
    {
      id: "av-erp-costs-crew",
      label: "LRE AV costs & crew (migration 145)",
      status: avCostsOk ? "ok" : "missing",
      detail: avCostsOk
        ? "av_job_costs is available (145 applied)."
        : `Paste and run supabase/migrations/145_av_job_costs_crew.sql in Supabase → SQL Editor. (${
            avCosts.error?.message ?? "table missing"
          })`,
      href: "/rentals/costs",
      hrefLabel: "AV Costs",
    },
    {
      id: "av-erp-credits",
      label: "LRE AV invoice credits (migration 146)",
      status: avCreditsOk ? "ok" : "missing",
      detail: avCreditsOk
        ? "av_invoice_credits is available (146 applied)."
        : `Paste and run supabase/migrations/146_av_invoice_credits.sql in Supabase → SQL Editor. (${
            avCredits.error?.message ?? "table missing"
          })`,
      href: "/rentals/invoices",
      hrefLabel: "AV Invoices",
    },
    {
      id: "av-erp-crew-rollup",
      label: "LRE AV crew → labor costs (migration 147)",
      status: avCrewRollupOk ? "ok" : "missing",
      detail: avCrewRollupOk
        ? "av_job_costs.booking_id is available (147 applied)."
        : `Paste and run supabase/migrations/147_av_crew_cost_rollup.sql in Supabase → SQL Editor. (${
            avCrewRollup.error?.message ?? "column missing"
          })`,
      href: "/rentals/crew",
      hrefLabel: "AV Crew",
    },
    {
      id: "av-erp-terminal-tokens",
      label: "LRE AV Developer API keys (migration 148)",
      status: avTokensOk ? "ok" : "missing",
      detail: avTokensOk
        ? "av_integration_tokens is available (148 applied)."
        : `Paste and run supabase/migrations/148_av_integration_tokens.sql in Supabase → SQL Editor. (${
            avTokens.error?.message ?? "table missing"
          })`,
      href: "/rentals/developer",
      hrefLabel: "AV Developer",
    },
    {
      id: "av-erp-venue-plan",
      label: "LRE AV text kind + venue plan (migration 149)",
      status: avVenuePlanOk ? "ok" : "missing",
      detail: avVenuePlanOk
        ? "av_opportunity_attachments is available (149 applied)."
        : `Paste and run supabase/migrations/149_av_text_kind_venue_plan_terminal.sql in Supabase → SQL Editor. (${
            avVenuePlan.error?.message ?? "table missing"
          })`,
      href: "/rentals/quotes",
      hrefLabel: "AV Estimates",
    },
    {
      id: "av-erp-km-gaps",
      label: "LRE AV KM gaps (migration 151)",
      status: avKmGapsOk ? "ok" : "missing",
      detail: avKmGapsOk
        ? "av_contractors / estimate response / serials / templates available (151 applied)."
        : `Paste and run supabase/migrations/151_av_km_gaps.sql in Supabase → SQL Editor. (${
            avKmGaps.error?.message ?? "table missing"
          })`,
      href: "/rentals/contractors",
      hrefLabel: "AV Contractors",
    },
    {
      id: "inquiry-forms-migration",
      label: "Inquiry Forms (migration 167)",
      status: inquiryFormsOk ? "ok" : "missing",
      detail: inquiryFormsOk
        ? `inquiry_forms is available (167 applied).${
            inquiryFormCount === null
              ? ""
              : inquiryFormCount === 0
                ? " No forms yet: open Inquiry Forms and add the starter forms."
                : ` ${inquiryFormCount} form${inquiryFormCount === 1 ? "" : "s"}.`
          } Public forms open at /inquire/<slug>; unfinished-inquiry alerts need CRON_SECRET and the service role.`
        : `Paste and run supabase/migrations/167_inquiry_forms.sql in Supabase SQL Editor (safe to run again). (${
            inquiryFormsTable.error?.message ?? "table missing"
          })`,
      href: "/inquiry-forms",
      hrefLabel: "Inquiry Forms",
    },
    {
      id: "current-rms-retired",
      label: "Current RMS env (retired)",
      status: currentRmsEnvLeft ? "warn" : "ok",
      detail: currentRmsEnvLeft
        ? "CURRENT_RMS_SUBDOMAIN and/or CURRENT_RMS_API_KEY are still set in this environment. LRE AV Import is gone — remove both from Vercel when ready."
        : "No CURRENT_RMS_* env vars set (Import retired).",
      href: "/rentals",
      hrefLabel: "LRE AV",
    },
    {
      id: "ask-index",
      label: "Ask the Hub knowledge index",
      status: !openai ? "warn" : avGuideFresh ? "ok" : "warn",
      detail: !openai
        ? "OpenAI key missing — Ask the Hub cannot rebuild embeddings."
        : avGuideFresh
          ? "LRE AV hub guide in the index includes the latest Reports / Import-retired copy."
          : "LRE AV guide looks stale or missing in kb_documents. Open Ask the Hub → Rebuild index so staff answers match the new AV modules.",
      href: "/ask",
      hrefLabel: "Rebuild on Ask the Hub",
    },
  ];

  const missing = checks.filter((c) => c.status === "missing").length;
  const warn = checks.filter((c) => c.status === "warn").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Hub health
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Admin checklist for calendar, crons, email, Drive, storage, and related
          integrations. Secrets are never shown — only present / missing.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {missing === 0 && warn === 0
            ? "Everything in this checklist looks ready."
            : `${missing} missing · ${warn} to review`}
        </p>
      </header>

      <PointsActivityPrivacyCard />

      <HolidayPreviewCard current={holidayPreview} />

      <ul className="space-y-3">
        {checks.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="mt-2 inline-block text-xs font-medium text-[var(--brand)] hover:underline"
                  >
                    {item.hrefLabel ?? "Open"}
                  </Link>
                ) : null}
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(item.status)}`}
              >
                {statusLabel(item.status)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Related:{" "}
        <Link href="/reports" className="text-[var(--brand)] hover:underline">
          Reports
        </Link>
        {" · "}
        <Link href="/support-guide" className="text-[var(--brand)] hover:underline">
          Support Guide
        </Link>
        {" · "}
        <Link href="/ask" className="text-[var(--brand)] hover:underline">
          Ask the Hub
        </Link>
      </p>
    </div>
  );
}
