export type ResourceType = "file" | "link";
export type ResourceVisibility = "everyone" | "staff" | "admin";

export type Resource = {
  id: string;
  title: string;
  category: string;
  type: ResourceType;
  url: string;
  description: string;
  visibility: ResourceVisibility;
  created_at: string;
  created_by: string | null;
};

export const RESOURCE_VISIBILITIES: ResourceVisibility[] = [
  "everyone",
  "staff",
  "admin",
];

export const VISIBILITY_LABELS: Record<ResourceVisibility, string> = {
  everyone: "Everyone",
  staff: "Staff & up",
  admin: "Admins only",
};

/** Suggested categories for the add form; chips also include any used in data. */
export const SUGGESTED_CATEGORIES = [
  "Guides",
  "Contracts",
  "Music",
  "Gear",
  "Branding",
  "Training",
] as const;
