export type GoalKind = "rock" | "pebble";
export type GoalStatus = "not_started" | "on_track" | "at_risk" | "done";

export type QuarterlyGoal = {
  id: string;
  user_id: string;
  year: number;
  quarter: number;
  kind: GoalKind;
  title: string;
  detail: string;
  status: GoalStatus;
  sort_order: number;
  created_at: string;
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: "Not started",
  on_track: "On track",
  at_risk: "At risk",
  done: "Done",
};

/** Click-through cycle order for the status chip. */
export const GOAL_STATUS_CYCLE: GoalStatus[] = [
  "not_started",
  "on_track",
  "at_risk",
  "done",
];
