import type { EventType } from "@/lib/types/event-reports";

export const PACKET_STATUSES = [
  "needs_completion",
  "in_progress",
  "completed",
] as const;

export type PacketStatus = (typeof PACKET_STATUSES)[number];

export const PACKET_STATUS_LABELS: Record<PacketStatus, string> = {
  needs_completion: "Needs completion",
  in_progress: "In progress",
  completed: "Completed",
};

export type Venue = {
  id: string;
  name: string;
  folder_slug: string;
  created_at: string;
  updated_at: string;
  aliases?: VenueAlias[];
};

export type VenueAlias = {
  id: string;
  venue_id: string;
  alias: string;
  created_at: string;
};

export type VenueWithAliases = Venue & { aliases: VenueAlias[] };

export type EventPacketAssignee = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type EventPacket = {
  id: string;
  calendar_uid: string | null;
  /** Optional Hub CRM (HoneyBook mirror) project for deep links. */
  honeybook_project_id: string | null;
  assignee_id: string;
  event_date: string;
  client_name: string;
  venue_raw: string;
  venue_id: string | null;
  event_type: string;
  /** Free-text when event_type is Other. */
  event_type_other: string;
  dj_name: string;
  status: PacketStatus;
  memorable_moment: string;
  hours_worked: string;
  equipment_notes: string;
  issues: string;
  client_feedback: string;
  rating: number | null;
  follow_up_needed: boolean;
  follow_up_notes: string;
  social_consent: boolean;
  social_consent_notes: string;
  /**
   * Optional archive packet (e.g. website-review backfill). Never overdue,
   * excluded from For You / reminders / packet_24h.
   */
  completion_optional: boolean;
  event_report_id: string | null;
  folder_name: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: EventPacketAssignee | null;
  venue?: Pick<Venue, "id" | "name" | "folder_slug"> | null;
};

export type EventPacketFormInput = {
  client_name: string;
  venue_raw: string;
  venue_id: string | null;
  event_type: EventType | string;
  event_type_other: string;
  dj_name: string;
  event_date: string;
  memorable_moment: string;
  equipment_notes: string;
  issues: string;
  client_feedback: string;
  rating: number;
  follow_up_needed: boolean;
  follow_up_notes: string;
  social_consent: boolean;
  social_consent_notes: string;
  mark_completed: boolean;
};

export type MediaTagDraft = {
  dj_name: string;
  location_name: string;
  event_date: string;
  client_name: string;
  event_type: string;
};
