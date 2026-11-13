import { pipelineStageMatchKey } from "@/lib/pipeline/pipeline-board";
import { outcomeOf } from "@/lib/pipeline/sales-report";

export type AutomationKey = "thank_you_review" | "followup_90day" | "proposal_nudge";

export const AUTOMATION_META: Record<
  AutomationKey,
  { label: string; when: string; delayLabel: string }
> = {
  thank_you_review: {
    label: "Thank you and review request",
    when: "After the event date, for booked projects.",
    delayLabel: "Days after the event",
  },
  followup_90day: {
    label: "Check-in after the event",
    when: "A while after the event date, for booked projects (default 90 days).",
    delayLabel: "Days after the event",
  },
  proposal_nudge: {
    label: "Proposal nudge",
    when: "When a project has sat in Proposal Sent with no movement.",
    delayLabel: "Days after the proposal was sent",
  },
};

export const AUTOMATION_KEYS = Object.keys(AUTOMATION_META) as AutomationKey[];

/** Only act on things that became due recently, so switching one on never emails old history. */
export const CATCH_UP_WINDOW_DAYS = 14;
/** Hard cap per automation per daily run. */
export const MAX_SENDS_PER_RUN = 25;

export type AutomationProject = {
  stage: string | null;
  booked_at: string | null;
  project_date: string | null; // YYYY-MM-DD
  record_type?: string | null;
  merged_into?: string | null;
};

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/**
 * Is this automation due for this project today?
 * `today` is YYYY-MM-DD. `proposalSentAt` is when the project last entered Proposal Sent.
 */
export function isAutomationDue(
  key: AutomationKey,
  delayDays: number,
  p: AutomationProject,
  today: string,
  proposalSentAt: string | null,
): boolean {
  if (p.record_type === "partnership" || p.merged_into) return false;
  const t = dayNumber(today);
  const inWindow = (anchor: string) => {
    const due = dayNumber(anchor) + delayDays;
    return t >= due && t <= due + CATCH_UP_WINDOW_DAYS;
  };
  if (key === "proposal_nudge") {
    if (pipelineStageMatchKey(p.stage) !== "proposal sent" || !proposalSentAt) return false;
    return inWindow(proposalSentAt);
  }
  if (outcomeOf(p) !== "booked" || !p.project_date) return false;
  return inWindow(p.project_date);
}
