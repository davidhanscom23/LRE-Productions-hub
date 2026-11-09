import type {
  PriceBreakdown,
  SpaceSelection,
  TechnicianLine,
} from "@/lib/venue-portals/pricing";
import { technicianLabel } from "@/lib/venue-portals/pricing";

export type ConvertQuoteLine = {
  description: string;
  qty: number;
  unitPrice: number;
  productId?: string | null;
  serviceId?: string | null;
};

export type PortalCatalogMapRow = {
  id: string;
  name: string;
  avProductId?: string | null;
  avServiceId?: string | null;
  /** Package price or addon unit price (fallback when totals omit a line). */
  unitPrice?: number;
};

type TotalsSnapshot = Partial<PriceBreakdown> & {
  savingsLabel?: string;
};

function catalogIds(row: PortalCatalogMapRow | undefined): {
  productId: string | null;
  serviceId: string | null;
} {
  if (!row) return { productId: null, serviceId: null };
  const productId = row.avProductId?.trim() || null;
  const serviceId = productId ? null : row.avServiceId?.trim() || null;
  return { productId, serviceId };
}

/** Flatten a venue request totals snapshot into Hub free-text quote lines. */
export function venueTotalsToOpportunityLines(
  totals: TotalsSnapshot | null | undefined,
): ConvertQuoteLine[] {
  if (!totals || typeof totals !== "object") return [];
  const lines: ConvertQuoteLine[] = [];

  for (const space of totals.spaces ?? []) {
    const spacePrefix = space.spaceName ? `${space.spaceName}: ` : "";
    if (space.packageLine && space.packageLine.amount > 0) {
      lines.push({
        description: `${spacePrefix}${space.packageLine.label}`,
        qty: 1,
        unitPrice: Number(space.packageLine.amount) || 0,
      });
    }
    for (const addon of space.addonLines ?? []) {
      if (!(addon.amount > 0)) continue;
      lines.push({
        description: `${spacePrefix}${addon.label}${addon.detail ? ` (${addon.detail})` : ""}`,
        qty: 1,
        unitPrice: Number(addon.amount) || 0,
      });
    }
  }

  appendFeeLines(lines, totals);
  return lines;
}

function appendFeeLines(lines: ConvertQuoteLine[], totals: TotalsSnapshot) {
  if ((totals.setup ?? 0) > 0) {
    lines.push({
      description: "Setup / strike",
      qty: 1,
      unitPrice: Number(totals.setup) || 0,
    });
  }

  const techs = (totals.technicians ?? []) as TechnicianLine[];
  for (const t of techs) {
    if (!(t.amount > 0)) continue;
    lines.push({
      description: technicianLabel(t),
      qty: 1,
      unitPrice: Number(t.amount) || 0,
    });
  }

  // Legacy snapshot: technician hours/amount without per-role lines.
  if (techs.length === 0 && (totals.technician?.amount ?? 0) > 0) {
    const hours = Number(totals.technician?.hours) || 0;
    lines.push({
      description:
        hours > 0
          ? `On-site technician (${hours} hr${hours === 1 ? "" : "s"})`
          : "On-site technician",
      qty: 1,
      unitPrice: Number(totals.technician?.amount) || 0,
    });
  }

  if ((totals.delivery ?? 0) > 0) {
    lines.push({
      description: "Delivery",
      qty: 1,
      unitPrice: Number(totals.delivery) || 0,
    });
  }

  if ((totals.savings ?? 0) > 0) {
    lines.push({
      description: totals.savingsLabel || "Partner savings",
      qty: 1,
      unitPrice: -Math.abs(Number(totals.savings) || 0),
    });
  }
}

/**
 * Build Hub quote lines from the stored selection + totals, attaching mapped
 * catalog product/service IDs when the portal package/add-on has them.
 */
export function venueSelectionToOpportunityLines(input: {
  selection: SpaceSelection[] | null | undefined;
  totals: TotalsSnapshot | null | undefined;
  packages: PortalCatalogMapRow[];
  addons: PortalCatalogMapRow[];
}): ConvertQuoteLine[] {
  const selection = Array.isArray(input.selection) ? input.selection : [];
  if (selection.length === 0) {
    return venueTotalsToOpportunityLines(input.totals);
  }

  const packagesById = new Map(input.packages.map((p) => [p.id, p]));
  const addonsById = new Map(input.addons.map((a) => [a.id, a]));
  const totals = input.totals ?? {};
  const lines: ConvertQuoteLine[] = [];

  for (const sel of selection) {
    const spacePrefix = sel.spaceName ? `${sel.spaceName}: ` : "";
    const spaceTotal = (totals.spaces ?? []).find(
      (s) => s.spaceId === sel.spaceId,
    );

    if (sel.packageId) {
      const pkg = packagesById.get(sel.packageId);
      const ids = catalogIds(pkg);
      const amount =
        spaceTotal?.packageLine?.amount ??
        Number(pkg?.unitPrice) ??
        0;
      if (amount > 0 || ids.productId || ids.serviceId) {
        lines.push({
          description: `${spacePrefix}${
            spaceTotal?.packageLine?.label ||
            (pkg ? `${pkg.name} package` : "Package")
          }`,
          qty: 1,
          unitPrice: Number(amount) || 0,
          productId: ids.productId,
          serviceId: ids.serviceId,
        });
      }
    }

    const addonAmounts = new Map<string, { amount: number; detail?: string; label: string }>();
    for (const al of spaceTotal?.addonLines ?? []) {
      // Match by label when we can't key by id on totals alone; filled below.
      addonAmounts.set(al.label, {
        amount: Number(al.amount) || 0,
        detail: al.detail,
        label: al.label,
      });
    }

    for (const [addonId, rawQty] of Object.entries(sel.addons ?? {})) {
      const qty = Math.floor(Number(rawQty) || 0);
      if (qty <= 0) continue;
      const addon = addonsById.get(addonId);
      const ids = catalogIds(addon);
      const fromTotals = addon
        ? addonAmounts.get(addon.name)
        : undefined;
      const amount =
        fromTotals?.amount ??
        (addon?.unitPrice != null ? Number(addon.unitPrice) * qty : 0);
      if (!(amount > 0) && !ids.productId && !ids.serviceId) continue;
      const detail =
        fromTotals?.detail || (qty > 1 ? `${qty} x` : undefined);
      lines.push({
        description: `${spacePrefix}${addon?.name || "Add-on"}${
          detail ? ` (${detail})` : ""
        }`,
        qty: 1,
        unitPrice: Number(amount) || 0,
        productId: ids.productId,
        serviceId: ids.serviceId,
      });
    }
  }

  appendFeeLines(lines, totals);
  return lines;
}

/** Pick gear window bounds from venue event day rows (Eastern wall dates). */
export function eventDaysToGearLocalBounds(
  days: {
    date?: string;
    startTime?: string;
    endTime?: string;
    start?: string;
    end?: string;
  }[],
): { startLocal: string | null; endLocal: string | null } {
  const sorted = [...days]
    .filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (sorted.length === 0) return { startLocal: null, endLocal: null };
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const startT = first.startTime || first.start || "09:00";
  const endT = last.endTime || last.end || "17:00";
  return {
    startLocal: `${first.date}T${startT.slice(0, 5)}`,
    endLocal: `${last.date}T${endT.slice(0, 5)}`,
  };
}
