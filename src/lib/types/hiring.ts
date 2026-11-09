export type JobStatus = "open" | "closed";
export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type JobOpening = {
  id: string;
  title: string;
  department: string;
  description: string;
  status: JobStatus;
  created_at: string;
};

export type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  job_id: string | null;
  stage: CandidateStage;
  notes: string;
  created_at: string;
  updated_at: string;
  /** Joined. */
  job_title?: string | null;
};

export const CANDIDATE_STAGES: { value: CandidateStage; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

export const HIRING_DEPARTMENTS = [
  "Audiovisual",
  "Corporate",
  "Wedding & Social",
  "Golf",
  "Office",
];

export function stageLabel(stage: CandidateStage): string {
  return CANDIDATE_STAGES.find((s) => s.value === stage)?.label ?? "Applied";
}
