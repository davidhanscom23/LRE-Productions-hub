/** HoneyBook CRM mirror types (Zapier → Hub). */

export type HoneyBookClient = {
  id: string;
  external_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  source_event: string;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type HoneyBookProject = {
  id: string;
  external_id: string | null;
  client_id: string | null;
  name: string;
  stage: string;
  project_type: string;
  project_date: string | null;
  budget: number | string | null;
  location: string;
  details: string;
  booked_at: string | null;
  source_event: string;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  share_token?: string | null;
  share_enabled?: boolean;
  /** Set when this card was merged into another (migration 175); hidden from the board. */
  merged_into?: string | null;
  merged_at?: string | null;
  /** 'event' (default) or 'partnership' (migration 177). */
  record_type?: "event" | "partnership" | null;
  /** Partnerships only: Venue, Vendor, or Other. */
  partner_kind?: string | null;
  /** Joined for UI */
  client_name?: string | null;
  client_email?: string | null;
  /** Assignees (Hub profiles) for board color + edit rights */
  assignees?: HoneyBookProjectAssignee[];
  /** Client file uploads on the share link */
  files?: {
    id: string;
    item_key: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    uploaded_at: string;
  }[];
  /** Client questionnaire on the share link */
  questionnaire?: {
    answers: Record<string, string>;
    submitted_at: string | null;
    updated_at?: string | null;
  } | null;
};

export type HoneyBookAssigneeRole = "lead" | "support";

export type HoneyBookProjectAssignee = {
  profile_id: string;
  full_name: string;
  color: string | null;
  /** Primary owner vs additional support staff. */
  role?: HoneyBookAssigneeRole;
  created_at?: string;
};

export type HoneyBookAssignmentRequest = {
  id: string;
  project_id: string;
  project_name?: string;
  requester_id: string;
  requester_name?: string;
  target_profile_id: string;
  target_name?: string;
  action: "add" | "remove";
  status: "pending" | "approved" | "denied";
  note: string;
  created_at: string;
};

export type HoneyBookPayment = {
  id: string;
  external_id: string | null;
  client_id: string | null;
  project_id: string | null;
  amount: number | string;
  currency: string;
  paid_at: string | null;
  note: string;
  source_event: string;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Joined for UI */
  client_name?: string | null;
  project_name?: string | null;
};

export type HoneyBookWebhookEvent = {
  id: string;
  event_type: string;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
  status: "ok" | "error" | "ignored";
  error_message: string;
  created_at: string;
};

/** Common HoneyBook pipeline stages (free-text in DB; labels for UI). */
export const HONEYBOOK_STAGE_HINTS = [
  "Inquiry",
  "Proposal Sent",
  "Contract Sent",
  "Retainer Paid",
  "Paid in Full",
  "Completed",
  "Lost",
] as const;

export type HoneyBookStageEvent = {
  id: string;
  project_id: string;
  from_stage: string;
  to_stage: string;
  changed_by: string | null;
  created_at: string;
  changer_name?: string | null;
};

/** One entry in a project's running trail (staff note or email summary). */
export type HoneyBookProjectNote = {
  id: string;
  project_id: string;
  source: "manual" | "gmail" | "system";
  category: "note" | "email" | "change" | "action" | "status";
  body: string;
  mailbox: string;
  needs_action: boolean;
  action_done_at: string | null;
  occurred_at: string;
  /** Joined for UI: who wrote it (staff name, or the mailbox owner for email notes). */
  author_name?: string | null;
};

export function formatHoneyBookMoney(
  amount: number | string | null | undefined,
  currency = "USD",
): string {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function projectBudgetNumber(
  budget: number | string | null | undefined,
): number {
  return Number(budget) || 0;
}

/** Admin-only money details for a partnership (table honeybook_partnership_financials). */
export type PartnershipFinancials = {
  dealValue: number | null;
  notes: string;
};
