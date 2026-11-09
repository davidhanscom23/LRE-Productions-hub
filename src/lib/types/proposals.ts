import type { QuoteLineItem } from "@/lib/types/quoting";

export type ProposalStatus =
  | "draft"
  | "generated"
  | "uploaded"
  | "linked";

export type ProposalLineSnapshot = Pick<
  QuoteLineItem,
  "label" | "quantity" | "list_unit_price" | "quote_unit_price"
>;

export type Proposal = {
  id: string;
  quote_id: string | null;
  created_by: string;
  client_name: string;
  event_name: string;
  event_date: string | null;
  department: string;
  title: string;
  intro: string;
  notes: string;
  status: ProposalStatus;
  list_total: number;
  quote_total: number;
  lines_snapshot: ProposalLineSnapshot[];
  drive_file_id: string | null;
  drive_web_view_link: string;
  drive_folder_path: string;
  honeybook_project_id: string | null;
  honeybook_linked_at: string | null;
  generated_at: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  honeybook_project_name?: string | null;
};

export function proposalStatusLabel(status: ProposalStatus): string {
  switch (status) {
    case "generated":
      return "PDF ready";
    case "uploaded":
      return "On Drive";
    case "linked":
      return "Linked to HoneyBook";
    default:
      return "Draft";
  }
}

export const DEFAULT_PROPOSAL_INTRO =
  "Thank you for considering Vident Productions. Below is our proposed scope and investment for your event.";
