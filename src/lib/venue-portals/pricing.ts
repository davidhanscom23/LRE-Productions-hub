/**
 * Venue quote portal pricing. Pure functions: no I/O, no framework imports, so
 * the public wizard (live estimate) and the server submit action (authoritative
 * snapshot) run the exact same math.
 *
 * Rules (all rates are per venue, set in the admin screen):
 *  - Equipment  = selected package prices + add-ons (each/flat = price x qty).
 *  - Setup      = sum of each selected package's setup fee (once per space).
 *  - Technician = for every space whose package includes technician roles
 *                 (e.g. Audio, Video): hourly roles bill rate x total event
 *                 hours; daily roles bill rate x number of event days.
 *                 Legacy packages flagged "includes technician" with no roles
 *                 bill the venue's single hourly technician rate.
 *  - Delivery   = one flat fee per quote, only when something is selected.
 *  - Savings    = savings % of EQUIPMENT only (never delivery/setup/labor, and
 *                 never hourly add-ons, which are labor).
 *  - Hourly add-ons bill quantity as hours, with a per-item minimum once > 0.
 */

export type PriceUnit = "each" | "flat" | "hour";

export type PortalRates = {
  deliveryFee: number;
  techHourlyRate: number;
  savingsPct: number;
  savingsLabel: string;
};

export type TechRateType = "hourly" | "daily";

export type PricingTechnician = {
  id: string;
  name: string;
  rateType: TechRateType;
  rate: number;
};

export type PricingPackage = {
  id: string;
  name: string;
  price: number;
  setupFee: number;
  includesTechnician: boolean;
  /** Technician roles included in this package (preferred over the legacy flag). */
  technicianIds?: string[];
};

export type PricingAddon = {
  id: string;
  name: string;
  unitPrice: number;
  priceUnit: PriceUnit;
  minQuantity: number;
};

export type EventDay = {
  date?: string;
  /** "HH:MM" 24h */
  startTime: string;
  endTime: string;
};

export type SpaceSelection = {
  spaceId: string;
  spaceName: string;
  packageId: string | null;
  /** addonId -> quantity */
  addons: Record<string, number>;
};

export type QuoteLine = { label: string; amount: number; detail?: string };

export type SpaceBreakdown = {
  spaceId: string;
  spaceName: string;
  packageLine: QuoteLine | null;
  addonLines: QuoteLine[];
};

export type TechnicianLine = {
  name: string;
  rateType: TechRateType;
  /** Hours (hourly) or days (daily), summed across spaces. */
  units: number;
  amount: number;
};

export type PriceBreakdown = {
  spaces: SpaceBreakdown[];
  delivery: number;
  setup: number;
  /** Totals across all technician lines (hours counts hourly units only). */
  technician: { hours: number; amount: number };
  technicians: TechnicianLine[];
  equipment: number;
  subtotal: number;
  savingsLabel: string;
  savings: number;
  total: number;
};

export function technicianLabel(t: TechnicianLine): string {
  const unit = t.rateType === "daily" ? "day" : "hr";
  return `${t.name} (${t.units} ${unit}${t.units === 1 ? "" : "s"})`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Hours for one day. An end at/before the start is treated as past midnight. */
export function dayHours(day: EventDay): number {
  const s = toMinutes(day.startTime);
  const e = toMinutes(day.endTime);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

export function totalEventHours(days: EventDay[]): number {
  return round2(days.reduce((sum, d) => sum + dayHours(d), 0));
}

export function computeQuote(input: {
  rates: PortalRates;
  packages: PricingPackage[];
  addons: PricingAddon[];
  selections: SpaceSelection[];
  days: EventDay[];
  technicians?: PricingTechnician[];
}): PriceBreakdown {
  const { rates, selections, days } = input;
  const packagesById = new Map(input.packages.map((p) => [p.id, p]));
  const addonsById = new Map(input.addons.map((a) => [a.id, a]));
  const hours = totalEventHours(days);
  const techById = new Map((input.technicians ?? []).map((t) => [t.id, t]));
  const dayCount = days.length;
  const techLines = new Map<string, TechnicianLine>();
  const addTech = (key: string, name: string, rateType: TechRateType, rate: number) => {
    const units = rateType === "daily" ? dayCount : hours;
    const line = techLines.get(key) ?? { name, rateType, units: 0, amount: 0 };
    line.units = round2(line.units + units);
    line.amount = round2(line.amount + units * rate);
    techLines.set(key, line);
  };

  let equipment = 0; // discountable
  let laborAddons = 0; // hourly add-ons: billed, not discounted
  let setup = 0;
  let anySelected = false;

  const spaces: SpaceBreakdown[] = selections.map((sel) => {
    let packageLine: QuoteLine | null = null;
    const pkg = sel.packageId ? packagesById.get(sel.packageId) : undefined;
    if (pkg) {
      anySelected = true;
      packageLine = { label: `${pkg.name} package`, amount: round2(pkg.price) };
      equipment += pkg.price;
      setup += pkg.setupFee;
      const roles = (pkg.technicianIds ?? [])
        .map((id) => techById.get(id))
        .filter((t): t is PricingTechnician => !!t);
      if (roles.length > 0) {
        for (const t of roles) addTech(t.id, t.name, t.rateType, t.rate);
      } else if (pkg.includesTechnician) {
        addTech("__legacy", "On-site technician", "hourly", rates.techHourlyRate);
      }
    }

    const addonLines: QuoteLine[] = [];
    for (const [addonId, rawQty] of Object.entries(sel.addons)) {
      const addon = addonsById.get(addonId);
      const qty = Math.floor(Number(rawQty) || 0);
      if (!addon || qty <= 0) continue;
      anySelected = true;
      if (addon.priceUnit === "hour") {
        const billed = Math.max(qty, addon.minQuantity);
        const amount = round2(addon.unitPrice * billed);
        laborAddons += amount;
        addonLines.push({
          label: addon.name,
          amount,
          detail: `${billed} hr${billed === 1 ? "" : "s"}`,
        });
      } else {
        const amount = round2(addon.unitPrice * qty);
        equipment += amount;
        addonLines.push({
          label: addon.name,
          amount,
          detail: qty > 1 ? `${qty} x` : undefined,
        });
      }
    }

    return {
      spaceId: sel.spaceId,
      spaceName: sel.spaceName,
      packageLine,
      addonLines,
    };
  });

  equipment = round2(equipment);
  setup = round2(setup);
  const technicians = Array.from(techLines.values());
  const techAmount = round2(technicians.reduce((n, t) => n + t.amount, 0));
  const techHours = round2(
    technicians.filter((t) => t.rateType === "hourly").reduce((n, t) => n + t.units, 0),
  );
  const delivery = anySelected ? round2(rates.deliveryFee) : 0;
  const subtotal = round2(equipment + laborAddons + setup + techAmount + delivery);
  const pct = Math.min(100, Math.max(0, rates.savingsPct));
  const savings = round2((equipment * pct) / 100);

  return {
    spaces,
    delivery,
    setup,
    technician: { hours: techHours, amount: techAmount },
    technicians,
    equipment,
    subtotal,
    savingsLabel: rates.savingsLabel,
    savings,
    total: round2(subtotal - savings),
  };
}
