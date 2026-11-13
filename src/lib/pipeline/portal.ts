/** Client portal: what a client sees, in one place, on /project/<token>. Pure shaping helpers. */

export type PortalContract = { title: string; status: "sent" | "signed" | "declined"; url: string; signedAt: string | null };
export type PortalInvoice = {
  number: string;
  title: string;
  status: "sent" | "partial" | "paid";
  total: number;
  balance: number;
  nextDueAt: string | null;
  url: string;
};
export type PortalFloorPlan = { name: string; spaceName: string; url: string };
export type PortalMeeting = { title: string; minutes: number; url: string };

export type PortalItems = {
  contracts: PortalContract[];
  invoices: PortalInvoice[];
  floorPlans: PortalFloorPlan[];
  meetings: PortalMeeting[];
};

export type ActionItem = { kind: "contract" | "invoice"; label: string; href: string; cta: string };

/** The things the client still needs to do, most important first (sign, then pay). */
export function portalActionItems(items: PortalItems, today: string): ActionItem[] {
  const out: ActionItem[] = [];
  for (const c of items.contracts) {
    if (c.status === "sent") out.push({ kind: "contract", label: `Sign: ${c.title}`, href: c.url, cta: "Review and sign" });
  }
  for (const i of items.invoices) {
    if (i.balance > 0) {
      const late = i.nextDueAt && i.nextDueAt < today ? " (past due)" : "";
      out.push({
        kind: "invoice",
        label: `Invoice ${i.number}${i.title ? `: ${i.title}` : ""}${late}`,
        href: i.url,
        cta: "View and pay",
      });
    }
  }
  return out;
}

export function isEmptyPortal(items: PortalItems): boolean {
  return !items.contracts.length && !items.invoices.length && !items.floorPlans.length && !items.meetings.length;
}
