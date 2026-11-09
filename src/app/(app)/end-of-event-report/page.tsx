import { EventReportsPageClient } from "@/components/event-reports/event-reports-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type {
  EventReport,
  EventReportReporter,
} from "@/lib/types/event-reports";

type ReportRow = Omit<EventReport, "reporter"> & {
  reporter: EventReportReporter | EventReportReporter[] | null;
};

export default async function EndOfEventReportPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("event_reports")
    .select(
      `
      id,
      reporter_id,
      event_date,
      client_name,
      venue,
      event_type,
      event_type_other,
      hours_worked,
      equipment_notes,
      memorable_moment,
      issues,
      client_feedback,
      rating,
      follow_up_needed,
      follow_up_notes,
      created_at,
      reporter:profiles!event_reports_reporter_id_fkey (
        id,
        full_name,
        email,
        avatar_url
      )
    `,
    )
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Couldn’t load reports: {error.message}
      </div>
    );
  }

  const reports: EventReport[] = ((data ?? []) as ReportRow[]).map((row) => ({
    ...row,
    event_type_other: row.event_type_other ?? "",
    reporter: Array.isArray(row.reporter)
      ? (row.reporter[0] ?? null)
      : row.reporter,
  }));

  const canSeeAll =
    profile.role === "admin" || profile.role === "trainer";

  return (
    <EventReportsPageClient
      reporterName={profile.full_name || profile.email}
      reporterEmail={profile.email}
      currentUserId={profile.id}
      reports={reports}
      canSeeAll={canSeeAll}
      isAdmin={profile.role === "admin"}
    />
  );
}
