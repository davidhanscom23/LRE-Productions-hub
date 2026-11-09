import { HiringClient } from "@/components/hiring/hiring-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { HiringApplication } from "@/lib/types/hiring-applications";
import type { Candidate, JobOpening } from "@/lib/types/hiring";
import type {
  InterviewSchedule,
  InterviewTemplate,
} from "@/lib/types/hiring-ats";
import { redirect } from "next/navigation";

export default async function HiringPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: jobRows, error } = await supabase
    .from("job_openings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Hiring needs a database update</p>
        <p className="mt-2">
          Run migration <code>055_hiring.sql</code> in Supabase, then refresh. (
          {error.message})
        </p>
      </div>
    );
  }

  const jobs = (jobRows ?? []) as JobOpening[];
  const jobTitle = new Map(jobs.map((j) => [j.id, j.title]));

  const { data: candRows } = await supabase
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });

  const candidates: Candidate[] = ((candRows ?? []) as Candidate[]).map((c) => ({
    ...c,
    job_title: c.job_id ? (jobTitle.get(c.job_id) ?? null) : null,
  }));

  const { data: appRows, error: appError } = await supabase
    .from("hiring_applications")
    .select("*")
    .order("created_at", { ascending: false });

  const applications = appError
    ? null
    : ((appRows ?? []) as Record<string, unknown>[]).map((row) => ({
        ...(row as HiringApplication),
        assessment_track: String(row.assessment_track ?? ""),
        assessment_answers:
          row.assessment_answers &&
          typeof row.assessment_answers === "object" &&
          !Array.isArray(row.assessment_answers)
            ? (row.assessment_answers as Record<string, string>)
            : {},
      }));

  const candidateName = new Map(candidates.map((c) => [c.id, c.full_name]));

  const { data: interviewRows } = await supabase
    .from("interview_schedules")
    .select("*")
    .order("scheduled_at", { ascending: true });
  const interviews: InterviewSchedule[] = (
    (interviewRows ?? []) as InterviewSchedule[]
  ).map((i) => ({
    ...i,
    candidate_name: candidateName.get(i.candidate_id) ?? null,
  }));

  const { data: templateRows } = await supabase
    .from("interview_templates")
    .select("*")
    .order("created_at", { ascending: false });
  const templates = (templateRows ?? []) as InterviewTemplate[];

  return (
    <HiringClient
      jobs={jobs}
      candidates={candidates}
      applications={applications}
      applicationsError={appError?.message ?? null}
      interviews={interviews}
      templates={templates}
    />
  );
}
