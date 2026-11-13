import type { TimeOffType } from "@/lib/types/time-off";

export type StaffingPerson = {
  id: string;
  full_name: string;
  email: string;
  departments: string[];
};

export type TimeOffSource = "hub" | "feed";

export type DayCoverage = {
  dateKey: string;
  weekdayKey: string;
  weekdayLabel: string;
  /** Active staff not on Hub or planner time off for this day. */
  available: StaffingPerson[];
  onTimeOff: {
    person: StaffingPerson;
    type: TimeOffType;
    /** Where the absence was found — Hub, planner, or both (de-duped to one row). */
    sources: TimeOffSource[];
    /** Hub time_off_requests.id when Hub contributes to this row. */
    hubRequestId: string | null;
    /**
     * True when admins can clear this Hub mark from Staffing (single-day Hub
     * request for this date). planner-only rows are not clearable here.
     */
    clearable: boolean;
  }[];
  events: { title: string; start: string; venue: string | null }[];
  /**
   * AV quotation/order jobs whose gear window overlaps this day and that
   * still have no confirmed crew booking.
   */
  needsCrew: StaffingCrewNeed[];
};

export type StaffingCrewNeed = {
  opportunityId: string;
  reference: string;
  subject: string;
  status: "quotation" | "order";
  href: string;
};
