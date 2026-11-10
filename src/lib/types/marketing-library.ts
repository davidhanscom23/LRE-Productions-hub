export type MarketingLinkSection = "reviews" | "photos";

export type MarketingLink = {
  id: string;
  section: MarketingLinkSection;
  label: string;
  url: string;
  sort_order: number;
  created_at: string;
};

export type MarketingVideo = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  dj_name: string;
  tags: string[];
  sort_order: number;
  created_at: string;
};

/** Category filter chips for the video library. */
export const MARKETING_VIDEO_CATEGORIES = [
  "Audiovisual",
  "Lighting & FX",
] as const;
