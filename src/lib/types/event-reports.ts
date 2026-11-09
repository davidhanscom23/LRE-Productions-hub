export const EVENT_TYPES = [
  "Wedding",
  "Corporate",
  "Birthday",
  "Anniversary",
  "School Dance",
  "Other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventReportReporter = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type EventReport = {
  id: string;
  reporter_id: string;
  event_date: string;
  client_name: string;
  venue: string;
  event_type: EventType | string;
  event_type_other?: string | null;
  hours_worked?: string | null;
  equipment_notes: string;
  memorable_moment: string;
  issues: string;
  client_feedback: string;
  rating: number;
  follow_up_needed: boolean;
  follow_up_notes: string;
  created_at: string;
  reporter: EventReportReporter | null;
};

export type EventReportInput = {
  event_date: string;
  client_name: string;
  venue: string;
  event_type: EventType;
  event_type_other: string;
  equipment_notes: string;
  memorable_moment: string;
  issues: string;
  client_feedback: string;
  rating: number;
  follow_up_needed: boolean;
  follow_up_notes: string;
};
