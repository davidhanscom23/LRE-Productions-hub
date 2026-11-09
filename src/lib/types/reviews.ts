export type CycleStatus = "open" | "closed";
export type SelfStatus = "not_started" | "submitted";
export type ManagerStatus = "not_started" | "in_progress" | "shared";
export type GoalStatus = "not_started" | "in_progress" | "done";

/** One competency rated 1–5 with a comment, keyed by competency. */
export type RatingEntry = { score: number | null; comment: string };
export type RatingMap = Record<string, RatingEntry>;

export type ReviewGoal = {
  title: string;
  detail: string;
  status: GoalStatus;
};

export const REVIEW_COMPETENCIES: { key: string; label: string }[] = [
  { key: "professionalism", label: "Professionalism" },
  { key: "reliability", label: "Reliability & punctuality" },
  { key: "client_experience", label: "Client experience" },
  { key: "technical", label: "Technical skill" },
  { key: "teamwork", label: "Teamwork" },
];

export const GOAL_STATUSES: { value: GoalStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export type ReviewCycle = {
  id: string;
  name: string;
  description: string;
  due_date: string | null;
  status: CycleStatus;
  created_at: string;
};

/** Admin-facing full review row (from performance_reviews). */
export type PerformanceReview = {
  id: string;
  cycle_id: string;
  subject_id: string;
  self_ratings: RatingMap;
  self_overall: string;
  self_status: SelfStatus;
  self_submitted_at: string | null;
  manager_ratings: RatingMap;
  manager_overall: string;
  overall_rating: number | null;
  goals: ReviewGoal[];
  manager_status: ManagerStatus;
  reviewed_at: string | null;
  shared_at: string | null;
  /** Joined. */
  subject_name?: string;
};

/** Staff-facing review (from list_my_reviews) — manager fields blank until shared. */
export type MyReview = {
  id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_status: CycleStatus;
  due_date: string | null;
  self_ratings: RatingMap;
  self_overall: string;
  self_status: SelfStatus;
  self_submitted_at: string | null;
  manager_status: ManagerStatus;
  shared: boolean;
  manager_ratings: RatingMap;
  manager_overall: string;
  overall_rating: number | null;
  goals: ReviewGoal[];
  reviewed_at: string | null;
};

export function emptyRatings(): RatingMap {
  const map: RatingMap = {};
  for (const c of REVIEW_COMPETENCIES) map[c.key] = { score: null, comment: "" };
  return map;
}

export function normalizeRatings(value: unknown): RatingMap {
  const base = emptyRatings();
  if (value && typeof value === "object") {
    for (const c of REVIEW_COMPETENCIES) {
      const raw = (value as Record<string, unknown>)[c.key];
      if (raw && typeof raw === "object") {
        const r = raw as Record<string, unknown>;
        const score =
          typeof r.score === "number" && r.score >= 1 && r.score <= 5
            ? r.score
            : null;
        base[c.key] = {
          score,
          comment: typeof r.comment === "string" ? r.comment : "",
        };
      }
    }
  }
  return base;
}

export function normalizeGoals(value: unknown): ReviewGoal[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((g) => {
      if (!g || typeof g !== "object") return null;
      const r = g as Record<string, unknown>;
      const status = ["not_started", "in_progress", "done"].includes(
        r.status as string,
      )
        ? (r.status as GoalStatus)
        : "not_started";
      return {
        title: typeof r.title === "string" ? r.title : "",
        detail: typeof r.detail === "string" ? r.detail : "",
        status,
      };
    })
    .filter((g): g is ReviewGoal => g !== null && g.title.trim().length > 0);
}
