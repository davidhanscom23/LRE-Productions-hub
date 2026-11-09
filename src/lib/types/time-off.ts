export type TimeOffType =
  | "vacation"
  | "sick"
  | "personal"
  | "unavailable"
  | "other";

export type TimeOffStatus = "pending" | "approved" | "denied" | "cancelled";

export type TimeOffRequest = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: TimeOffType;
  note: string;
  status: TimeOffStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
  updated_at: string;
  /** Joined for admin views. */
  requester_name?: string | null;
};

export type StaffAvailability = {
  user_id: string;
  available_days: string[];
  note: string;
  updated_at: string;
};

export type TeamTimeOff = {
  id: string;
  user_id: string;
  full_name: string;
  start_date: string;
  end_date: string;
  type: TimeOffType;
};

export const TIME_OFF_TYPES: { value: TimeOffType; label: string }[] = [
  { value: "unavailable", label: "Unavailable" },
  { value: "vacation", label: "Vacation" },
  { value: "personal", label: "Personal" },
  { value: "sick", label: "Sick" },
  { value: "other", label: "Other" },
];

export const WEEKDAYS: { key: string; label: string }[] = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

export function timeOffTypeLabel(type: TimeOffType): string {
  return TIME_OFF_TYPES.find((t) => t.value === type)?.label ?? "Unavailable";
}
