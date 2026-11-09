export const SERVICE_CATEGORIES = [
  "Planning & coordination",
  "Transportation & delivery",
  "Event rentals",
  "Kitchen & serving",
  "Golf & tournament events",
  "Decor & signage",
  "Experiences & production",
  "Other",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

const RULES: [RegExp, ServiceCategory][] = [
  [/planning|management|coordination|consultation|marketing and event/i, "Planning & coordination"],
  [/transport|transporation|delivery|pick ?up|set\/strike|striking|after hours|damage waiver/i, "Transportation & delivery"],
  [/^(china|flatware|glass|linen|silver chiavari|white resin|8' farm|36" bistro|dance floor|lacey|lounge|danity|hot box|freezer|fridge)/i, "Event rentals"],
  [/^(12" sautee|30 quart|chaffer|sheet pan|serving spoons|tongs|lexan)/i, "Kitchen & serving"],
  [/golf|contest|challenge|marshmallow|tournament|hole |yardage|mulligan|pin drone|victory lane|feather flags|checkered|solid color|traffic cones|tires|racing|trophies|swag|massage|stretch|spin to win|beat the pro|sponsor|tpc sawgrass|on course/i, "Golf & tournament events"],
  [/backdrop|sign\b|balloon|arch|marquee|floral|centerpiece|welcome sign/i, "Decor & signage"],
  [/stage|production|entertainment|audio|photograph|tasting|tour|sailing|dinner|cake|event registration/i, "Experiences & production"],
];

/** Catalog categories whose items are rented gear; everything else is billed as a sale/service on an estimate. */
const RENTAL_CATEGORIES = new Set<string>(["Event rentals", "Kitchen & serving"]);

/** Estimate line kind for a catalog item picked into an estimate. Staff can still change it on the line. */
export function textKindForCategory(category: string): "rental" | "sale" {
  return RENTAL_CATEGORIES.has(category.trim()) ? "rental" : "sale";
}

/** Best-guess category for an imported service. Editable afterwards. */
export function categoryOf(name: string): ServiceCategory {
  for (const [re, cat] of RULES) if (re.test(name.trim())) return cat;
  return "Other";
}
