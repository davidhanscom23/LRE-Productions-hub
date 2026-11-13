/** AV rental ERP domain types (KM AV CRM parity). Tables use av_* prefix. */

export type AvOpportunityStatus = "draft" | "quotation" | "order" | "closed";

export type AvOwnerCompany = "vident" | "lukesent" | "lre";

export const AV_OWNER_COMPANIES: { value: AvOwnerCompany; label: string }[] = [
  { value: "vident", label: "Vident" },
  { value: "lukesent", label: "LukesENT" },
  { value: "lre", label: "LRE Pro" },
];

export function ownerCompanyLabel(v: string | null | undefined): string {
  return AV_OWNER_COMPANIES.find((o) => o.value === v)?.label ?? "Vident";
}

export type AvProductKind = "rental" | "package" | "sale" | "consumable";

export type AvServiceKind = "crew" | "transport" | "fee";

export type AvChargedMode =
  | "daily"
  | "weekly"
  | "monthly"
  | "hourly"
  | "flat"
  | "three_day_week"
  | "daily_capped_4";

export type AvDayCountRule = "calendar" | "billable_map" | "leeway";

export type AvCustomer = {
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
  country: string;
  standing_discount_pct: number;
  tax_exempt?: boolean;
  notes: string;
  is_quotable: boolean;
  is_retired: boolean;
  external_rms_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AvJobVenue = {
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
  country: string;
  access_notes: string;
  power_notes: string;
  parking_notes: string;
  notes: string;
  is_retired: boolean;
  external_rms_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AvProductGroup = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type AvRateDefinition = {
  id: string;
  name: string;
  charged_mode: AvChargedMode;
  day_count_rule: AvDayCountRule;
  leeway_minutes: number;
  fewest_units: number;
  billable_days_map: Record<string, number>;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

export type AvProduct = {
  id: string;
  group_id: string | null;
  name: string;
  code: string;
  description: string;
  kind: AvProductKind;
  rental_price: number;
  sale_price: number | null;
  replacement_charge: number | null;
  qty_owned: number;
  owner_company: AvOwnerCompany;
  buffer_pct: number;
  turnaround_hours: number;
  weight_lbs: number | null;
  photo_path: string | null;
  is_active: boolean;
  external_rms_id: string | null;
  /** Permanent trace of the last event this product went out to (checklist check-outs). */
  last_used_event?: string;
  last_used_at?: string | null;
  last_used_by_name?: string | null;
};

export type AvService = {
  id: string;
  name: string;
  code: string;
  description: string;
  kind: AvServiceKind;
  unit_price: number;
  is_active: boolean;
  external_rms_id: string | null;
};

export type AvOpportunity = {
  id: string;
  reference: string;
  subject: string;
  status: AvOpportunityStatus;
  customer_id: string | null;
  venue_id: string | null;
  rate_definition_id: string | null;
  gear_starts_at: string | null;
  gear_ends_at: string | null;
  charge_starts_at: string | null;
  charge_ends_at: string | null;
  bill_whole_event: boolean;
  surcharge_pct: number;
  discount_pct: number;
  venue_markup_pct: number;
  venue_markup_enabled: boolean;
  /** direct = we bill the client; venue = the venue pays us (migration 187). */
  billing_type?: "direct" | "venue";
  /** Hub project (event card) this estimate belongs to (migration 192). */
  pipeline_project_id?: string | null;
  transport_notes: string;
  notes: string;
  is_template: boolean;
  source_opportunity_id: string | null;
  external_rms_id: string | null;
  share_token: string | null;
  share_enabled: boolean;
  estimate_response?: "accepted" | "declined" | null;
  estimate_responded_at?: string | null;
  estimate_response_note?: string;
  estimate_signer_name?: string;
  contract_response?: "accepted" | "declined" | null;
  contract_responded_at?: string | null;
  contract_response_note?: string;
  contract_signer_name?: string;
  created_at: string;
  updated_at: string;
};

export type AvContractor = {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  skills: string[];
  day_rate: number | null;
  hour_rate: number | null;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AvDocumentTemplate = {
  id: string;
  name: string;
  kind: "estimate" | "invoice" | "other";
  terms: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AvChangeOrderStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "void";

export type AvChangeOrder = {
  id: string;
  opportunity_id: string;
  number: string;
  subject: string;
  summary: string;
  amount_delta: number;
  status: AvChangeOrderStatus;
  share_token: string | null;
  share_enabled: boolean;
  response_note: string;
  signer_name: string;
  responded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AvChangeOrderApplyMode = "add" | "adjust_qty" | "remove";

/** Accepted customer e-sign row (staff quote banners / resend). */
export type AcceptedSignatureMeta = {
  id: string;
  doc_kind: "estimate" | "contract" | "change_order";
  signer_name: string;
  signed_at: string;
  signed_pdf_emailed_at: string | null;
  signed_pdf_email_to: string;
  signed_pdf_storage_path: string;
  change_order_id: string | null;
};

export type AvChangeOrderLine = {
  id: string;
  change_order_id: string;
  source_line_id: string | null;
  product_id: string | null;
  service_id: string | null;
  description: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
  sort_order: number;
  text_kind: "rental" | "sale" | null;
  apply_mode: AvChangeOrderApplyMode;
  created_at: string;
};

export type AvOpportunityNote = {
  id: string;
  opportunity_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  author_name?: string | null;
};

export type AvProductUnit = {
  id: string;
  product_id: string;
  serial: string;
  barcode: string;
  status: "in" | "out" | "retired";
  notes: string;
  created_at: string;
  updated_at: string;
};

export type AvOpportunityGroup = {
  id: string;
  opportunity_id: string;
  name: string;
  sort_order: number;
};

/** Free-text line tag (no catalog product/service). */
export type AvTextLineKind = "rental" | "sale";

export type AvOpportunityLine = {
  id: string;
  opportunity_id: string;
  group_id: string | null;
  parent_line_id: string | null;
  product_id: string | null;
  service_id: string | null;
  description: string;
  qty: number;
  /** Pre–venue-markup unit price (staff “real” price). */
  unit_price: number;
  discount_pct: number;
  sort_order: number;
  /** rental/sale when product_id and service_id are null; else null. */
  text_kind: AvTextLineKind | null;
};

export type AvOpportunityAttachment = {
  id: string;
  opportunity_id: string;
  kind: "room_photo" | "other";
  storage_path: string;
  file_name: string;
  content_type: string;
  created_at: string;
};

export type AvOpportunityPlanMarker = {
  id: string;
  opportunity_id: string;
  attachment_id: string;
  line_id: string | null;
  label: string;
  x: number;
  y: number;
};

export type AvOpportunityRenderStatus =
  | "pending"
  | "ready"
  | "approved"
  | "rejected"
  | "failed";

export type AvOpportunityRender = {
  id: string;
  opportunity_id: string;
  attachment_id: string | null;
  storage_path: string | null;
  status: AvOpportunityRenderStatus;
  prompt: string;
  error_message: string;
  show_on_estimate: boolean;
  approved_at: string | null;
  created_at: string;
};

export type AvHold = {
  id: string;
  opportunity_id: string;
  line_id: string | null;
  product_id: string;
  qty: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

export type AvGearMovementDirection = "out" | "back";

export type AvGearMovement = {
  id: string;
  opportunity_id: string;
  product_id: string;
  line_id: string | null;
  direction: AvGearMovementDirection;
  qty: number;
  moved_at: string;
  notes: string;
  created_by: string | null;
  created_at: string;
};

export type AvActivity = {
  id: string;
  subject: string;
  kind: string;
  due_at: string;
  opportunity_id: string | null;
  settled_at: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AvInvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "void";

export type AvSupplier = {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
  is_active: boolean;
  external_rms_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AvInvoice = {
  id: string;
  reference: string;
  opportunity_id: string | null;
  customer_id: string | null;
  subject: string;
  status: AvInvoiceStatus;
  issued_at: string | null;
  due_at: string | null;
  subtotal: number;
  tax_rate_pct?: number;
  tax_amount?: number;
  total: number;
  amount_paid: number;
  amount_credited: number;
  notes: string;
  pay_token?: string;
  pay_enabled?: boolean;
  last_reminded_at?: string | null;
  remind_count?: number;
  created_at: string;
  updated_at: string;
};

export type AvInvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  qty: number;
  unit_price: number;
  sort_order: number;
};

export type AvPayment = {
  id: string;
  invoice_id: string;
  amount: number;
  received_at: string;
  method: string;
  reference: string;
  notes: string;
  created_at: string;
};

export type AvInvoiceCredit = {
  id: string;
  invoice_id: string;
  reference: string;
  amount: number;
  issued_at: string;
  reason: string;
  notes: string;
  created_at: string;
};

export type AvJobCostCategory =
  | "labor"
  | "sub_hire"
  | "transport"
  | "consumable"
  | "fee"
  | "other";

export type AvJobCost = {
  id: string;
  opportunity_id: string;
  amount: number;
  category: AvJobCostCategory;
  supplier_id: string | null;
  description: string;
  cost_date: string;
  tax_amount?: number;
  currency_code?: string;
  receipt_storage_path?: string;
  receipt_file_name?: string;
  /** When set, this labor row is synced from a crew booking. */
  booking_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AvBookingStatus =
  | "offered"
  | "confirmed"
  | "declined"
  | "cancelled";

export type AvContractorBooking = {
  id: string;
  opportunity_id: string;
  profile_id: string | null;
  contractor_id?: string | null;
  role_label: string;
  starts_at: string;
  ends_at: string;
  day_rate: number | null;
  status: AvBookingStatus;
  notes: string;
  /** When true, confirmed + day_rate syncs a labor cost row. */
  roll_into_costs: boolean;
  created_at: string;
  updated_at: string;
};

export const AV_OPPORTUNITY_STATUS_LABELS: Record<AvOpportunityStatus, string> = {
  draft: "Draft",
  quotation: "Quotation",
  order: "Order",
  closed: "Closed",
};

export type AvProductAccessory = {
  id: string;
  parent_product_id: string;
  child_product_id: string;
  qty: number;
  is_required: boolean;
  /** Listed on the package but not auto-added to estimates. */
  is_optional?: boolean;
};
