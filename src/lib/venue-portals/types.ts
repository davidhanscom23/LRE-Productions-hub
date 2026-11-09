import type {
  PortalRates,
  PricingAddon,
  PricingPackage,
  PricingTechnician,
} from "@/lib/venue-portals/pricing";

/** Everything the public wizard needs. Never includes internal fields (notify email, etc.). */
export type PortalPublic = {
  id: string;
  slug: string;
  name: string;
  headline: string;
  intro: string;
  heroImageUrl: string | null;
  logoUrl: string | null;
  accentColor: string;
  eventTypes: string[];
  defaultStartTime: string; // "HH:MM"
  defaultEndTime: string;
  isPublished: boolean;
  /** Book Now deposit percent of estimated (post-discount) total. */
  depositPct: number;
  rates: PortalRates;
};

export type PortalSpace = {
  id: string;
  name: string;
  imageUrl: string | null;
  capacity: number | null;
  isCustomQuote: boolean;
};

export type PortalPackage = PricingPackage & {
  tagline: string;
  isPopular: boolean;
  items: string[];
};

export type PortalAddon = PricingAddon & {
  description: string;
  imageUrl: string | null;
  maxQuantity: number | null;
  isOrderable: boolean;
  note: string;
};

export type PortalEnhancement = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
};

export type PortalTechnician = PricingTechnician;

export type PortalBundle = {
  portal: PortalPublic;
  spaces: PortalSpace[];
  packages: PortalPackage[];
  technicians: PortalTechnician[];
  addons: PortalAddon[];
  enhancements: PortalEnhancement[];
};
