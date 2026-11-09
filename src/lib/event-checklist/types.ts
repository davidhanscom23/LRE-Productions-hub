/** Event gear checklist types (migration 192). */

export type ChecklistPass = "out" | "back";
export type ChecklistSource = "in_house" | "client_supplied" | "sub_rented";
export type ChecklistFlag = "none" | "damaged" | "missing";

export const SOURCE_LABELS: Record<ChecklistSource, string> = {
  in_house: "Our gear",
  client_supplied: "Client supplied",
  sub_rented: "Sub-rented",
};

export type Checklist = {
  id: string;
  project_id: string;
  opportunity_id: string | null;
  depart_at: string | null;
  return_at: string | null;
  status: "open" | "closed";
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  product_id: string | null;
  name: string;
  qty_needed: number;
  source: ChecklistSource;
  returns: boolean;
  note: string;
  sort_order: number;
  origin: "contract" | "manual";
  removed_at: string | null;
  qty_out: number;
  qty_back: number;
};

export type ChecklistHistoryRow = {
  id: string;
  item_id: string;
  pass: ChecklistPass;
  qty: number;
  flag: ChecklistFlag;
  note: string;
  photo_path: string | null;
  checked_at: string;
  checked_by_name: string;
  item_name: string;
};

export type InfoVenue = {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  access_notes: string;
  power_notes: string;
  parking_notes: string;
  loading_dock_notes: string;
  path_notes: string;
  load_in_hours: string;
  venue_rules: string;
  loadin_updated_at: string | null;
};

export type InfoPerson = { name: string | null; email: string | null; phone: string | null };

/** Everything about the event the checklist page shows besides the gear list. */
export type EventInfo = {
  project: { id: string; name: string; project_date: string | null; location: string };
  room: string;
  venue: InfoVenue | null;
  client: InfoPerson | null;
  customer: (InfoPerson & { contact_name: string | null }) | null;
  staff: { name: string; role: "lead" | "support"; phone: string; email: string }[];
  floor_plans: { id: string; name: string; space_name: string; data: unknown }[];
};
