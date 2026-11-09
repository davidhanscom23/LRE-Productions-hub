export type TimeEntrySource = "manual" | "calendar";

export type TimeEntry = {
  id: string;
  user_id: string;
  department: string;
  event_name: string;
  notes: string;
  source: TimeEntrySource;
  clocked_in_at: string;
  clocked_out_at: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};
