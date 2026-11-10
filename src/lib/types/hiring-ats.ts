export type InterviewStatus = "scheduled" | "completed" | "canceled";

export type InterviewSchedule = {
  id: string;
  candidate_id: string;
  scheduled_at: string;
  interviewer: string;
  location: string;
  notes: string;
  status: InterviewStatus;
  created_at: string;
  /** Joined. */
  candidate_name?: string | null;
};

export type InterviewTemplate = {
  id: string;
  title: string;
  track: string;
  questions: string[];
  created_at: string;
};

export const INTERVIEW_TRACKS = [
  "general",
  "Audiovisual",
];

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  canceled: "Canceled",
};
