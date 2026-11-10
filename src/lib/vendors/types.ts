import type { Department } from "@/lib/types/database";

export const VENDOR_CATEGORIES = [
  "Balloons",
  "Catering",
  "Florals",
  "Lighting",
  "Photo / Video",
  "Rentals",
  "Transportation",
  "Venue",
  "Other",
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number] | string;

export type Vendor = {
  id: string;
  category: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
  preferred: boolean;
  departments: Department[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorDeleteRequest = {
  id: string;
  vendor_id: string;
  requested_by: string | null;
  reason: string;
  status: "pending" | "approved" | "declined";
  reviewed_by: string | null;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
};

export type VendorAuditEvent = {
  id: string;
  vendor_id: string | null;
  actor_id: string | null;
  action: string;
  summary: string;
  before_row: Record<string, unknown> | null;
  after_row: Record<string, unknown> | null;
  created_at: string;
};

export const VENDORS_SHEET_SETTING_KEY = "vendors_spreadsheet_id";
export const VENDORS_SHEET_TITLE = "LRE Hub Vendors";
export const VENDORS_SHEET_HEADERS = [
  "Category",
  "Company",
  "Contact",
  "Phone",
  "Email",
  "Website",
  "Preferred",
  "Departments",
  "Notes",
  "Hub ID",
  "Updated At",
] as const;

export function vendorSearchHaystack(vendor: Vendor): string {
  return [
    vendor.category,
    vendor.company_name,
    vendor.contact_name,
    vendor.phone,
    vendor.email,
    vendor.website,
    vendor.notes,
    vendor.preferred ? "preferred" : "",
    ...(vendor.departments ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

export function vendorToKbContent(vendor: Vendor): string {
  const lines = [
    `Vendor: ${vendor.company_name}`,
    vendor.preferred ? "Preferred vendor: yes" : null,
    vendor.category ? `Category: ${vendor.category}` : null,
    vendor.contact_name ? `Contact: ${vendor.contact_name}` : null,
    vendor.phone ? `Phone: ${vendor.phone}` : null,
    vendor.email ? `Email: ${vendor.email}` : null,
    vendor.website ? `Website: ${vendor.website}` : null,
    vendor.departments?.length
      ? `Departments: ${vendor.departments.join(", ")}`
      : null,
    vendor.notes ? `Notes: ${vendor.notes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}
