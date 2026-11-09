"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomerAction } from "@/app/(app)/rentals/customers/actions";
import {
  addOpportunityGroupAction,
  moveOpportunityGroupAction,
  moveOpportunityLineAction,
  moveOpportunityLineToGroupAction,
  renameOpportunityGroupAction,
  addOpportunityLineAction,
  addOptionalPackageItemAction,
  clearHoldsAction,
  confirmAndReserveAction,
  deleteOpportunityAction,
  deleteOpportunityLineAction,
  addOpportunityNoteAction,
  downloadContractPdfAction,
  downloadEstimatePdfAction,
  emailEstimateAction,
  enableEstimateShareAction,
  resendSignedPdfAction,
  revokeEstimateShareAction,
  repricePackageLineFromAccessoriesAction,
  saveQuoteAsTemplateAction,
  updateOpportunityHeaderAction,
  updateOpportunityLineAction,
  type ShortageLine,
} from "@/app/(app)/rentals/quotes/actions";
import { createJobVenueAction } from "@/app/(app)/rentals/venues/actions";
import { addCategoryAction, saveServiceAction } from "@/app/(app)/services/actions";
import { textKindForCategory } from "@/lib/services-catalog/categories";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { QuoteChangeOrdersPanel } from "@/components/av-erp/quote-change-orders-panel";
import { QuoteCostsPanel } from "@/components/av-erp/quote-costs-panel";
import {
  VenuePlanPanel,
  type RenderView,
  type RoomPhotoView,
} from "@/components/av-erp/venue-plan-panel";
import { isCumulativePackageName } from "@/lib/av-erp/product-accessories";
import { shortageForLine, type HoldWindow } from "@/lib/av-erp/availability";
import { isoToDatetimeLocalEastern } from "@/lib/av-erp/datetime";
import type { JobFinanceSummary } from "@/lib/av-erp/job-finance";
import {
  computeOpportunityPrices,
  customerUnitPrice,
  lineTotal,
} from "@/lib/av-erp/pricing";
import {
  AV_OPPORTUNITY_STATUS_LABELS,
  type AcceptedSignatureMeta,
  type AvChangeOrder,
  type AvChangeOrderLine,
  type AvCustomer,
  type AvJobCost,
  type AvJobVenue,
  type AvOpportunity,
  type AvOpportunityGroup,
  type AvOpportunityLine,
  type AvOpportunityNote,
  type AvOpportunityPlanMarker,
  type AvOpportunityStatus,
  type AvProduct,
  type AvRateDefinition,
  type AvService,
  type AvSupplier,
  type AvTextLineKind,
} from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

/** A saved HoneyBook service from the Hub Services catalog, offered as a pick-list item on estimates. */
export type EstimateCatalogItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  unitPrice: number;
};

const NEW_CATEGORY = "__new__";

type Props = {
  /** Services catalog items (active only) that staff can drop onto the estimate. */
  catalogItems?: EstimateCatalogItem[];
  /** Every category name, built-in and custom. */
  catalogCategories?: string[];
  /** Admins and Leads can edit catalog items and add categories from the estimate. */
  canEditCatalog?: boolean;
  opportunity: AvOpportunity;
  groups: AvOpportunityGroup[];
  lines: AvOpportunityLine[];
  holds: HoldWindow[];
  customers: Pick<AvCustomer, "id" | "name">[];
  venues: Pick<AvJobVenue, "id" | "name">[];
  /** Events (Hub projects) this estimate can be linked to. */
  projects?: { id: string; name: string; project_date: string | null }[];
  rates: AvRateDefinition[];
  products: AvProduct[];
  /** Effective unit price for picker (catalog rental_price or Comes-with rollup). */
  productQuotePrices?: Record<string, number>;
  /** Optional Comes-with items per product, added by hand from the package line. */
  optionalAccessories?: {
    parent_product_id: string;
    child_product_id: string;
    qty: number;
    name: string;
    price: number;
  }[];
  services: AvService[];
  finance: JobFinanceSummary | null;
  costs: AvJobCost[];
  suppliers: Pick<AvSupplier, "id" | "name">[];
  crewCount: number;
  roomPhotos: RoomPhotoView[];
  planMarkers: AvOpportunityPlanMarker[];
  renders: RenderView[];
  venuePlanError: string | null;
  geminiConfigured: boolean;
  discussionNotes?: AvOpportunityNote[];
  changeOrders?: AvChangeOrder[];
  changeOrderLinesByCoId?: Record<string, AvChangeOrderLine[]>;
  acceptedSignatures?: AcceptedSignatureMeta[];
};

/** Parents first, then their accessory children (keeps nest readable). */
function nestLines(lines: AvOpportunityLine[]): AvOpportunityLine[] {
  const children = new Map<string, AvOpportunityLine[]>();
  const roots: AvOpportunityLine[] = [];
  for (const line of lines) {
    if (line.parent_line_id) {
      const list = children.get(line.parent_line_id) ?? [];
      list.push(line);
      children.set(line.parent_line_id, list);
    } else {
      roots.push(line);
    }
  }
  const out: AvOpportunityLine[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    out.push(root);
    seen.add(root.id);
    for (const child of children.get(root.id) ?? []) {
      out.push(child);
      seen.add(child.id);
    }
  }
  for (const line of lines) {
    if (!seen.has(line.id)) out.push(line);
  }
  return out;
}

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function QuoteEditorClient({
  catalogItems = [],
  catalogCategories = [],
  canEditCatalog = false,
  opportunity,
  groups,
  lines,
  holds,
  customers,
  venues,
  projects = [],
  rates,
  products,
  productQuotePrices = {},
  optionalAccessories = [],
  services,
  finance,
  costs,
  suppliers,
  crewCount,
  roomPhotos,
  planMarkers,
  renders,
  venuePlanError,
  geminiConfigured,
  discussionNotes = [],
  changeOrders = [],
  changeOrderLinesByCoId = {},
  acceptedSignatures = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [header, setHeader] = useState({
    subject: opportunity.subject,
    status: opportunity.status,
    customer_id: opportunity.customer_id ?? "",
    venue_id: opportunity.venue_id ?? "",
    rate_definition_id: opportunity.rate_definition_id ?? "",
    gear_starts_at: isoToDatetimeLocalEastern(opportunity.gear_starts_at),
    gear_ends_at: isoToDatetimeLocalEastern(opportunity.gear_ends_at),
    charge_starts_at: isoToDatetimeLocalEastern(opportunity.charge_starts_at),
    charge_ends_at: isoToDatetimeLocalEastern(opportunity.charge_ends_at),
    bill_whole_event: opportunity.bill_whole_event,
    surcharge_pct: String(opportunity.surcharge_pct),
    discount_pct: String(opportunity.discount_pct),
    venue_markup_enabled: opportunity.venue_markup_enabled,
    venue_markup_pct: String(opportunity.venue_markup_pct),
    billing_type: opportunity.billing_type ?? "direct",
    honeybook_project_id: opportunity.honeybook_project_id ?? "",
    transport_notes: opportunity.transport_notes,
    notes: opportunity.notes,
  });

  const [addProductId, setAddProductId] = useState("");
  const [addServiceId, setAddServiceId] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addTextKind, setAddTextKind] = useState<AvTextLineKind>("rental");
  const [addUnitPrice, setAddUnitPrice] = useState("0");
  const [addGroupId, setAddGroupId] = useState(groups[0]?.id ?? "");
  const [addQty, setAddQty] = useState("1");
  const [sectionName, setSectionName] = useState("");
  const [pickCatalogId, setPickCatalogId] = useState("");
  const [pickCatalogCategory, setPickCatalogCategory] = useState("all");
  const [catalogEdit, setCatalogEdit] = useState<{
    name: string;
    price: string;
    category: string;
    newCategory: string;
  } | null>(null);
  const [pickSearch, setPickSearch] = useState("");
  const [pickType, setPickType] = useState<"all" | "equipment" | "package" | "service" | "catalog">("all");
  const [openPackages, setOpenPackages] = useState<Set<string>>(() => new Set());
  const [sharePath, setSharePath] = useState<string | null>(
    opportunity.share_enabled && opportunity.share_token
      ? `/estimate/${opportunity.share_token}`
      : null,
  );
  const [shortageBlock, setShortageBlock] = useState<ShortageLine[] | null>(
    null,
  );
  const [extraCustomers, setExtraCustomers] = useState<
    Pick<AvCustomer, "id" | "name">[]
  >([]);
  const [extraVenues, setExtraVenues] = useState<
    Pick<AvJobVenue, "id" | "name">[]
  >([]);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
  });
  const [newVenue, setNewVenue] = useState({
    name: "",
    city: "",
    address_line1: "",
    phone: "",
  });

  const customerOptions = useMemo(() => {
    const seen = new Set(customers.map((c) => c.id));
    return [
      ...customers,
      ...extraCustomers.filter((c) => !seen.has(c.id)),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, extraCustomers]);

  const venueOptions = useMemo(() => {
    const seen = new Set(venues.map((v) => v.id));
    return [
      ...venues,
      ...extraVenues.filter((v) => !seen.has(v.id)),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [venues, extraVenues]);

  const productById = useMemo(() => {
    const m = new Map<string, AvProduct>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const prices = useMemo(
    () =>
      computeOpportunityPrices({
        lines: lines.map((l) => ({
          qty: Number(l.qty),
          unitPrice: Number(l.unit_price),
          discountPct: Number(l.discount_pct),
        })),
        surchargePct: header.billing_type === "venue" ? 0 : Number(header.surcharge_pct) || 0,
        discountPct: Number(header.discount_pct) || 0,
        venueMarkupEnabled: header.venue_markup_enabled,
        venueMarkupPct: Number(header.venue_markup_pct) || 0,
      }),
    [lines, header],
  );

  const holdCount = holds.length;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function saveHeader(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", opportunity.id);
    Object.entries(header).forEach(([k, v]) => {
      if (typeof v === "boolean") fd.set(k, v ? "on" : "off");
      else fd.set(k, v);
    });
    run(() => updateOpportunityHeaderAction(fd));
  }

  async function attachHeaderField(
    patch: Partial<{ customer_id: string; venue_id: string }>,
  ) {
    const next = { ...header, ...patch };
    setHeader(next);
    const fd = new FormData();
    fd.set("id", opportunity.id);
    Object.entries(next).forEach(([k, v]) => {
      if (typeof v === "boolean") fd.set(k, v ? "on" : "off");
      else fd.set(k, v);
    });
    const saved = await updateOpportunityHeaderAction(fd);
    if (!saved.ok) return saved;
    router.refresh();
    return saved;
  }

  function createCustomerInline() {
    const name = newCustomer.name.trim();
    if (!name) {
      setError("Customer name is required.");
      return;
    }
    const fd = new FormData();
    fd.set("name", name);
    fd.set("contact_name", newCustomer.contact_name.trim());
    fd.set("email", newCustomer.email.trim());
    fd.set("phone", newCustomer.phone.trim());
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createCustomerAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.id) {
        setError(
          "Customer was created but no id came back — refresh and pick them.",
        );
        return;
      }
      const id = result.id;
      setExtraCustomers((prev) => [...prev, { id, name }]);
      setCreatingCustomer(false);
      setNewCustomer({ name: "", contact_name: "", email: "", phone: "" });
      const saved = await attachHeaderField({ customer_id: id });
      if (!saved.ok) {
        setHeader((h) => ({ ...h, customer_id: id }));
        setError(saved.error);
        setMessage("Customer created — Save header to attach them.");
        return;
      }
      setMessage(`Customer “${name}” added and selected on this estimate.`);
    });
  }

  function createVenueInline() {
    const name = newVenue.name.trim();
    if (!name) {
      setError("Venue name is required.");
      return;
    }
    const fd = new FormData();
    fd.set("name", name);
    fd.set("city", newVenue.city.trim());
    fd.set("address_line1", newVenue.address_line1.trim());
    fd.set("phone", newVenue.phone.trim());
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createJobVenueAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.id) {
        setError(
          "Venue was created but no id came back — refresh and pick them.",
        );
        return;
      }
      const id = result.id;
      setExtraVenues((prev) => [...prev, { id, name }]);
      setCreatingVenue(false);
      setNewVenue({ name: "", city: "", address_line1: "", phone: "" });
      const saved = await attachHeaderField({ venue_id: id });
      if (!saved.ok) {
        setHeader((h) => ({ ...h, venue_id: id }));
        setError(saved.error);
        setMessage("Venue created — Save header to attach them.");
        return;
      }
      setMessage(`Venue “${name}” added and selected on this estimate.`);
    });
  }

  function quotePriceForProduct(productId: string): number {
    if (productId in productQuotePrices) {
      return Number(productQuotePrices[productId]) || 0;
    }
    const p = products.find((x) => x.id === productId);
    return p ? Number(p.rental_price) || 0 : 0;
  }

  const selectedCatalogItem = catalogItems.find((c) => c.id === pickCatalogId) ?? null;

  function pickCatalogItem(id: string) {
    setPickCatalogId(id);
    setCatalogEdit(null);
    const item = catalogItems.find((c) => c.id === id);
    if (!item) return;
    setAddProductId("");
    setAddServiceId("");
    setAddDescription(item.name);
    setAddUnitPrice(String(item.unitPrice));
    setAddTextKind(textKindForCategory(item.category));
  }

  function saveCatalogEdit() {
    if (!selectedCatalogItem || !catalogEdit) return;
    const wantsNew = catalogEdit.category === NEW_CATEGORY;
    const category = wantsNew ? catalogEdit.newCategory.trim() : catalogEdit.category;
    if (!category) {
      setError("Type a name for the new category.");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (wantsNew) {
        const c = await addCategoryAction(category);
        // "Already exists" is fine: the item just joins that category.
        if (c.error && c.error !== "That category already exists.") {
          setError(c.error);
          return;
        }
      }
      const r = await saveServiceAction({
        id: selectedCatalogItem.id,
        name: catalogEdit.name,
        description: selectedCatalogItem.description,
        category,
        unitPrice: Number(catalogEdit.price),
        active: true,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      setAddDescription(catalogEdit.name.trim());
      setAddUnitPrice(String(Number(catalogEdit.price)));
      setAddTextKind(textKindForCategory(category));
      setCatalogEdit(null);
      setPickCatalogCategory("all");
      setMessage("Catalog item saved.");
      router.refresh();
    });
  }

  function addLine(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("opportunity_id", opportunity.id);
    fd.set("group_id", addGroupId);
    fd.set("product_id", addProductId);
    fd.set("service_id", addServiceId);
    fd.set("qty", addQty);
    fd.set("unit_price", addUnitPrice);
    if (!addProductId && !addServiceId) {
      fd.set("description", addDescription);
      fd.set("text_kind", addTextKind);
    }
    run(async () => {
      const result = await addOpportunityLineAction(fd);
      if (result.ok) {
        setAddProductId("");
        setAddServiceId("");
        setPickCatalogId("");
        setCatalogEdit(null);
        setAddDescription("");
        setAddTextKind("rental");
        setAddUnitPrice("0");
        setAddQty("1");
      }
      return result;
    });
  }

  const canAddLine = Boolean(
    addProductId || addServiceId || addDescription.trim(),
  );

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sort_order - b.sort_order),
    [groups],
  );
  /** Product ids already nested under each package line (for optional picks). */
  const nestedProductIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of lines) {
      if (!l.parent_line_id || !l.product_id) continue;
      const set = map.get(l.parent_line_id) ?? new Set<string>();
      set.add(l.product_id);
      map.set(l.parent_line_id, set);
    }
    return map;
  }, [lines]);
  /**
   * Before anything customer-facing goes out (PDF, share link, email), list
   * what is inside each "0 -" package so leftover items get taken off.
   */
  function confirmPackageContents(): boolean {
    const blocks: string[] = [];
    for (const parent of lines) {
      if (parent.parent_line_id || !parent.product_id) continue;
      const product = productById.get(parent.product_id);
      if (!product || !isCumulativePackageName(product.name)) continue;
      const kids = lines.filter((l) => l.parent_line_id === parent.id);
      if (kids.length === 0) continue;
      const total = kids.reduce(
        (sum, l) =>
          sum +
          lineTotal({
            qty: Number(l.qty),
            unitPrice: Number(l.unit_price),
            discountPct: Number(l.discount_pct),
          }),
        0,
      );
      blocks.push(
        `${parent.description} (${kids.length} items, ${money(total)})\n` +
          kids.map((l) => `  • ${Number(l.qty)} × ${l.description}`).join("\n"),
      );
    }
    if (blocks.length === 0) return true;
    return window.confirm(
      `Check the package contents before this goes out. Anything you don't need should come off the estimate.\n\n${blocks.join("\n\n")}\n\nEverything look right?`,
    );
  }

  const { childCount, childTotal } = useMemo(() => {
    const count = new Map<string, number>();
    const total = new Map<string, number>();
    for (const l of lines) {
      if (!l.parent_line_id) continue;
      count.set(l.parent_line_id, (count.get(l.parent_line_id) ?? 0) + 1);
      total.set(
        l.parent_line_id,
        (total.get(l.parent_line_id) ?? 0) +
          lineTotal({
            qty: Number(l.qty),
            unitPrice: Number(l.unit_price),
            discountPct: Number(l.discount_pct),
          }),
      );
    }
    return { childCount: count, childTotal: total };
  }, [lines]);
  /** Section headers followed by their items; package contents show only when the package is expanded. */
  const flatItems = useMemo(() => {
    type Item =
      | { type: "header"; id: string | null; name: string; total: number; index: number; count: number }
      | { type: "line"; line: AvOpportunityLine };
    const out: Item[] = [];
    const buckets: { id: string | null; name: string }[] = [
      ...sortedGroups.map((g) => ({ id: g.id as string | null, name: g.name })),
    ];
    if (lines.some((l) => !l.group_id || !sortedGroups.some((g) => g.id === l.group_id))) {
      buckets.push({ id: null, name: "No section" });
    }
    buckets.forEach((b, index) => {
      const inBucket = lines.filter((l) =>
        b.id ? l.group_id === b.id : !l.group_id || !sortedGroups.some((g) => g.id === l.group_id),
      );
      const total = inBucket.reduce(
        (sum, l) =>
          sum +
          lineTotal({
            qty: Number(l.qty),
            unitPrice: Number(l.unit_price),
            discountPct: Number(l.discount_pct),
          }),
        0,
      );
      out.push({ type: "header", id: b.id, name: b.name, total, index, count: sortedGroups.length });
      for (const l of nestLines(inBucket)) {
        if (l.parent_line_id && !openPackages.has(l.parent_line_id)) continue;
        out.push({ type: "line", line: l });
      }
    });
    return out;
  }, [lines, sortedGroups, openPackages]);

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href="/rentals/quotes"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← Estimates
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {opportunity.reference}{" "}
            <span className="text-[var(--muted)] font-normal">
              {AV_OPPORTUNITY_STATUS_LABELS[opportunity.status]}
            </span>
          </h1>
          {opportunity.estimate_response ? (
            <p className="mt-1 text-sm">
              Estimate{" "}
              <span className="font-semibold">
                {opportunity.estimate_response}
              </span>
              {opportunity.estimate_response === "accepted" &&
              opportunity.estimate_signer_name?.trim()
                ? ` by ${opportunity.estimate_signer_name.trim()}`
                : ""}
              {opportunity.estimate_responded_at
                ? ` · ${new Date(opportunity.estimate_responded_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET`
                : ""}
              {opportunity.estimate_response_note?.trim()
                ? ` — ${opportunity.estimate_response_note.trim()}`
                : ""}
            </p>
          ) : null}
          {opportunity.contract_response ? (
            <p className="mt-1 text-sm">
              Contract{" "}
              <span className="font-semibold">
                {opportunity.contract_response}
              </span>
              {opportunity.contract_response === "accepted" &&
              opportunity.contract_signer_name?.trim()
                ? ` by ${opportunity.contract_signer_name.trim()}`
                : ""}
              {opportunity.contract_responded_at
                ? ` · ${new Date(opportunity.contract_responded_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET`
                : ""}
              {opportunity.contract_response_note?.trim()
                ? ` — ${opportunity.contract_response_note.trim()}`
                : ""}
            </p>
          ) : null}
          {acceptedSignatures.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              {acceptedSignatures.map((sig) => {
                const label =
                  sig.doc_kind === "estimate"
                    ? "Estimate"
                    : sig.doc_kind === "contract"
                      ? "Contract"
                      : "Change order";
                const emailed = sig.signed_pdf_emailed_at
                  ? `Emailed ${new Date(sig.signed_pdf_emailed_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET${sig.signed_pdf_email_to ? ` → ${sig.signed_pdf_email_to}` : ""}`
                  : "Signed PDF not emailed yet";
                return (
                  <li
                    key={sig.id}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span>
                      {label} signed PDF · {emailed}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        setMessage(null);
                        startTransition(async () => {
                          const result = await resendSignedPdfAction(sig.id);
                          if (!result.ok) {
                            setError(result.error);
                            return;
                          }
                          setMessage(
                            result.to
                              ? `Resent signed PDF to ${result.to}.`
                              : "Resent signed PDF.",
                          );
                          router.refresh();
                        });
                      }}
                      className="underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Resend signed PDF
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirmPackageContents()) return;
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await downloadEstimatePdfAction(opportunity.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const bytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
                  c.charCodeAt(0),
                );
                const blob = new Blob([bytes], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.fileName;
                a.click();
                URL.revokeObjectURL(url);
                setMessage("Estimate PDF downloaded.");
              });
            }}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          >
            Download estimate PDF
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirmPackageContents()) return;
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await downloadContractPdfAction(opportunity.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const bytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
                  c.charCodeAt(0),
                );
                const blob = new Blob([bytes], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.fileName;
                a.click();
                URL.revokeObjectURL(url);
                setMessage("Contract PDF downloaded.");
              });
            }}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          >
            Download contract PDF
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirmPackageContents()) return;
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await enableEstimateShareAction(opportunity.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSharePath(result.path);
                const absolute = `${window.location.origin}${result.path}`;
                try {
                  await navigator.clipboard.writeText(absolute);
                  setMessage("Share link copied to clipboard.");
                } catch {
                  setMessage(`Share link: ${absolute}`);
                }
                router.refresh();
              });
            }}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          >
            {sharePath ? "Copy share link" : "Share estimate link"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirmPackageContents()) return;
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await emailEstimateAction(opportunity.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSharePath(
                  opportunity.share_token
                    ? `/estimate/${opportunity.share_token}`
                    : sharePath,
                );
                setMessage(`Estimate emailed to ${result.to}.`);
                router.refresh();
              });
            }}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          >
            Email estimate
          </button>
          {sharePath ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                run(async () => {
                  const result = await revokeEstimateShareAction(opportunity.id);
                  if (result.ok) {
                    setSharePath(null);
                    setMessage("Share link turned off.");
                  }
                  return result;
                });
              }}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted)]"
            >
              Revoke link
            </button>
          ) : null}
          {!opportunity.is_template ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                run(async () => {
                  const result = await saveQuoteAsTemplateAction(opportunity.id);
                  if (result.ok) setMessage("Saved as estimate template.");
                  return result;
                });
              }}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted)]"
            >
              Save as template
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setShortageBlock(null);
              const fd = new FormData();
              fd.set("opportunity_id", opportunity.id);
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const headerFd = new FormData();
                headerFd.set("id", opportunity.id);
                Object.entries(header).forEach(([k, v]) => {
                  if (typeof v === "boolean") headerFd.set(k, v ? "on" : "off");
                  else headerFd.set(k, v);
                });
                const saved = await updateOpportunityHeaderAction(headerFd);
                if (!saved.ok) {
                  setError(saved.error);
                  return;
                }
                const reserved = await confirmAndReserveAction(fd);
                if (!reserved.ok) {
                  if (reserved.shortages?.length) {
                    setShortageBlock(reserved.shortages);
                  }
                  setError(reserved.error);
                  return;
                }
                setMessage(
                  reserved.pastShortage
                    ? "Confirmed past a shortage — free gear reserved."
                    : "Gear reserved for this estimate.",
                );
                router.refresh();
              });
            }}
            className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirm and reserve gear
          </button>
          {holdCount > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("opportunity_id", opportunity.id);
                run(async () => {
                  const result = await clearHoldsAction(fd);
                  if (result.ok) setMessage("Reservations cleared.");
                  return result;
                });
              }}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
            >
              Clear holds ({holdCount})
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const label = `${opportunity.reference} — ${header.subject || "Untitled"}`;
              if (
                !window.confirm(
                  `Delete ${label}?\n\nThis removes the estimate, its lines, and any gear holds. This cannot be undone.`,
                )
              ) {
                return;
              }
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await deleteOpportunityAction(opportunity.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.push("/rentals/quotes");
                router.refresh();
              });
            }}
            className="h-9 rounded-lg border border-red-200 px-3 text-sm text-red-700 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300"
          >
            Delete estimate
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {message}
        </p>
      ) : null}
      {shortageBlock && shortageBlock.length > 0 ? (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Gear shortage — confirm anyway?</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {shortageBlock.map((s) => (
              <li key={s.lineId}>
                {s.productName}: need {s.needed}, free {s.free}, short {s.short}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Confirm anyway reserves free qty only. Short items stay unreserved
            and a note is saved on the estimate with who confirmed and when.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("opportunity_id", opportunity.id);
                fd.set("confirm_anyway", "on");
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const reserved = await confirmAndReserveAction(fd);
                  if (!reserved.ok) {
                    setError(reserved.error);
                    return;
                  }
                  setShortageBlock(null);
                  setMessage(
                    "Confirmed past a shortage — free gear reserved; short items noted on the estimate.",
                  );
                  router.refresh();
                });
              }}
              className="h-9 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm anyway
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShortageBlock(null)}
              className="h-9 rounded-lg border border-amber-400 px-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={saveHeader}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Subject</span>
            <input
              value={header.subject}
              onChange={(e) => setHeader({ ...header, subject: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Status</span>
            <select
              value={header.status}
              onChange={(e) =>
                setHeader({
                  ...header,
                  status: e.target.value as AvOpportunityStatus,
                })
              }
              className={fieldClass}
            >
              {(Object.keys(AV_OPPORTUNITY_STATUS_LABELS) as AvOpportunityStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {AV_OPPORTUNITY_STATUS_LABELS[s]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Rate</span>
            <select
              value={header.rate_definition_id}
              onChange={(e) =>
                setHeader({ ...header, rate_definition_id: e.target.value })
              }
              className={fieldClass}
            >
              <option value="">Default</option>
              {rates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[var(--muted)]">Customer</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setCreatingVenue(false);
                  setCreatingCustomer((v) => !v);
                  setError(null);
                }}
                className="text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
              >
                {creatingCustomer ? "Cancel" : "New customer"}
              </button>
            </div>
            <select
              value={header.customer_id}
              onChange={(e) =>
                setHeader({ ...header, customer_id: e.target.value })
              }
              className={fieldClass}
            >
              <option value="">—</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="block text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[var(--muted)]">Venue</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setCreatingCustomer(false);
                  setCreatingVenue((v) => !v);
                  setError(null);
                }}
                className="text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
              >
                {creatingVenue ? "Cancel" : "New venue"}
              </button>
            </div>
            <select
              value={header.venue_id}
              onChange={(e) => setHeader({ ...header, venue_id: e.target.value })}
              className={fieldClass}
            >
              <option value="">—</option>
              {venueOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          {creatingCustomer ? (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 sm:col-span-2">
              <p className="text-xs font-medium text-[var(--foreground)]">
                Add customer to the system
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Name</span>
                  <input
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                    required
                    className={fieldClass}
                    placeholder="Company or person"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Contact</span>
                  <input
                    value={newCustomer.contact_name}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        contact_name: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Email</span>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Phone</span>
                  <input
                    value={newCustomer.phone}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, phone: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={createCustomerInline}
                className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Create customer"}
              </button>
            </div>
          ) : null}
          {creatingVenue ? (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 sm:col-span-2">
              <p className="text-xs font-medium text-[var(--foreground)]">
                Add venue to the system
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Name</span>
                  <input
                    value={newVenue.name}
                    onChange={(e) =>
                      setNewVenue({ ...newVenue, name: e.target.value })
                    }
                    required
                    className={fieldClass}
                    placeholder="Venue name"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">City</span>
                  <input
                    value={newVenue.city}
                    onChange={(e) =>
                      setNewVenue({ ...newVenue, city: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Phone</span>
                  <input
                    value={newVenue.phone}
                    onChange={(e) =>
                      setNewVenue({ ...newVenue, phone: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Address</span>
                  <input
                    value={newVenue.address_line1}
                    onChange={(e) =>
                      setNewVenue({
                        ...newVenue,
                        address_line1: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={createVenueInline}
                className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Create venue"}
              </button>
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Gear out (Eastern)
            </span>
            <input
              type="datetime-local"
              value={header.gear_starts_at}
              onChange={(e) =>
                setHeader({ ...header, gear_starts_at: e.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Gear back (Eastern)
            </span>
            <input
              type="datetime-local"
              value={header.gear_ends_at}
              onChange={(e) =>
                setHeader({ ...header, gear_ends_at: e.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Charge from (Eastern)
            </span>
            <input
              type="datetime-local"
              value={header.charge_starts_at}
              onChange={(e) =>
                setHeader({ ...header, charge_starts_at: e.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Charge to (Eastern)
            </span>
            <input
              type="datetime-local"
              value={header.charge_ends_at}
              onChange={(e) =>
                setHeader({ ...header, charge_ends_at: e.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Surcharge %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={header.surcharge_pct}
              onChange={(e) =>
                setHeader({ ...header, surcharge_pct: e.target.value })
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Discount %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={header.discount_pct}
              onChange={(e) =>
                setHeader({ ...header, discount_pct: e.target.value })
              }
              className={fieldClass}
            />
          </label>
        </div>
        <label className="block max-w-md text-sm">
          <span className="mb-1 block text-[var(--muted)]">Event (for the gear checklist)</span>
          <select
            value={header.honeybook_project_id}
            onChange={(e) => setHeader({ ...header, honeybook_project_id: e.target.value })}
            className={fieldClass}
          >
            <option value="">Not linked</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.project_date ? ` (${p.project_date})` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Links this estimate to its event card. The event&apos;s gear checklist then follows this estimate by itself.
          </span>
        </label>
        <label className="block max-w-md text-sm">
          <span className="mb-1 block text-[var(--muted)]">How this is billed</span>
          <select
            value={header.billing_type}
            onChange={(e) =>
              setHeader({ ...header, billing_type: e.target.value === "venue" ? "venue" : "direct" })
            }
            className={fieldClass}
          >
            <option value="direct">Direct: we bill the client (shows the surcharge)</option>
            <option value="venue">Venue partner: the venue pays us (no surcharge row, venue note added)</option>
          </select>
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Carries to the estimate and the invoice. Venue partner adds the line about the venue&apos;s service charge
            and taxes on the client&apos;s master bill.
          </span>
        </label>
        <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={header.venue_markup_enabled}
              onChange={(e) =>
                setHeader({
                  ...header,
                  venue_markup_enabled: e.target.checked,
                })
              }
            />
            Venue markup, hidden
          </label>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Increases customer-facing prices. Staff still see real unit prices
            when editing lines.
          </p>
          {header.venue_markup_enabled ? (
            <label className="mt-2 block max-w-[10rem] text-sm">
              <span className="mb-1 block text-[var(--muted)]">Markup %</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={header.venue_markup_pct}
                onChange={(e) =>
                  setHeader({ ...header, venue_markup_pct: e.target.value })
                }
                className={fieldClass}
              />
            </label>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save estimate details"}
        </button>
      </form>

      <section className="mt-6 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Lines
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.set("opportunity_id", opportunity.id);
              fd.set("name", sectionName || "Section");
              run(async () => {
                const result = await addOpportunityGroupAction(fd);
                if (result.ok) setSectionName("");
                return result;
              });
            }}
            className="flex gap-2"
          >
            <input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="New section name"
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
            >
              Add section
            </button>
          </form>
        </div>

        <form
          onSubmit={addLine}
          className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-6"
        >
          <label className="block text-sm sm:col-span-4">
            <span className="mb-1 block text-[var(--muted)]">Find an item</span>
            <input
              value={pickSearch}
              onChange={(e) => setPickSearch(e.target.value)}
              placeholder="Search by name…"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Type</span>
            <select
              value={pickType}
              onChange={(e) => setPickType(e.target.value as typeof pickType)}
              className={fieldClass}
            >
              <option value="all">All types</option>
              <option value="equipment">Equipment (rental / sale)</option>
              <option value="package">Packages</option>
              <option value="service">Services / labor</option>
              {catalogItems.length > 0 ? (
                <option value="catalog">HoneyBook services (rentals, DMC, golf)</option>
              ) : null}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Product</span>
            <select
              value={addProductId}
              onChange={(e) => {
                const id = e.target.value;
                setAddProductId(id);
                if (id) {
                  setAddServiceId("");
                  setPickCatalogId("");
                  setCatalogEdit(null);
                  setAddDescription("");
                  setAddUnitPrice(String(quotePriceForProduct(id)));
                }
              }}
              className={fieldClass}
            >
              <option value="">—</option>
              {products
                .filter(
                  (p) =>
                    p.is_active &&
                    (pickType === "all" ||
                      (pickType === "package" && p.kind === "package") ||
                      (pickType === "equipment" && p.kind !== "package")) &&
                    (!pickSearch.trim() ||
                      p.name.toLowerCase().includes(pickSearch.trim().toLowerCase())),
                )
                .map((p) => {
                  const price = quotePriceForProduct(p.id);
                  const fromItems =
                    p.kind === "package" &&
                    !(Number(p.rental_price) > 0) &&
                    price > 0;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({money(price)}
                      {fromItems ? " from items" : ""})
                    </option>
                  );
                })}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Or service</span>
            <select
              value={addServiceId}
              onChange={(e) => {
                const id = e.target.value;
                setAddServiceId(id);
                if (id) {
                  setAddProductId("");
                  setPickCatalogId("");
                  setCatalogEdit(null);
                  setAddDescription("");
                  const s = services.find((x) => x.id === id);
                  setAddUnitPrice(String(s ? Number(s.unit_price) || 0 : 0));
                }
              }}
              className={fieldClass}
            >
              <option value="">—</option>
              {services
                .filter(
                  (s) =>
                    s.is_active &&
                    (pickType === "all" || pickType === "service") &&
                    (!pickSearch.trim() ||
                      s.name.toLowerCase().includes(pickSearch.trim().toLowerCase())),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({money(Number(s.unit_price))})
                  </option>
                ))}
            </select>
          </label>
          {catalogItems.length > 0 && (pickType === "all" || pickType === "catalog") ? (
            <div className="grid gap-2 rounded-lg border border-dashed border-[var(--border)] p-2 sm:col-span-6 sm:grid-cols-6">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[var(--muted)]">Or HoneyBook service: category</span>
                <select
                  value={pickCatalogCategory}
                  onChange={(e) => setPickCatalogCategory(e.target.value)}
                  className={fieldClass}
                >
                  <option value="all">All categories</option>
                  {catalogCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-4">
                <span className="mb-1 block text-[var(--muted)]">HoneyBook service</span>
                <select
                  value={pickCatalogId}
                  onChange={(e) => pickCatalogItem(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">—</option>
                  {catalogCategories
                    .filter((c) => pickCatalogCategory === "all" || c === pickCatalogCategory)
                    .map((cat) => {
                      const items = catalogItems.filter(
                        (i) =>
                          i.category === cat &&
                          (!pickSearch.trim() ||
                            i.name.toLowerCase().includes(pickSearch.trim().toLowerCase())),
                      );
                      if (items.length === 0) return null;
                      return (
                        <optgroup key={cat} label={cat}>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({money(i.unitPrice)})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                </select>
              </label>
              {selectedCatalogItem && canEditCatalog ? (
                <div className="sm:col-span-6">
                  {catalogEdit ? (
                    <div className="grid gap-2 rounded-lg bg-[var(--background)] p-2 sm:grid-cols-6">
                      <label className="block text-sm sm:col-span-3">
                        <span className="mb-1 block text-[var(--muted)]">Name</span>
                        <input
                          value={catalogEdit.name}
                          onChange={(e) => setCatalogEdit({ ...catalogEdit, name: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[var(--muted)]">Price $</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={catalogEdit.price}
                          onChange={(e) => setCatalogEdit({ ...catalogEdit, price: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-[var(--muted)]">Category</span>
                        <select
                          value={catalogEdit.category}
                          onChange={(e) => setCatalogEdit({ ...catalogEdit, category: e.target.value })}
                          className={fieldClass}
                        >
                          {catalogCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value={NEW_CATEGORY}>+ New category…</option>
                        </select>
                      </label>
                      {catalogEdit.category === NEW_CATEGORY ? (
                        <label className="block text-sm sm:col-span-3">
                          <span className="mb-1 block text-[var(--muted)]">New category name</span>
                          <input
                            value={catalogEdit.newCategory}
                            onChange={(e) => setCatalogEdit({ ...catalogEdit, newCategory: e.target.value })}
                            maxLength={60}
                            className={fieldClass}
                          />
                        </label>
                      ) : null}
                      <div className="flex items-end gap-2 sm:col-span-3">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={saveCatalogEdit}
                          className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Save to catalog
                        </button>
                        <button
                          type="button"
                          onClick={() => setCatalogEdit(null)}
                          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setCatalogEdit({
                          name: selectedCatalogItem.name,
                          price: String(selectedCatalogItem.unitPrice),
                          category: selectedCatalogItem.category,
                          newCategory: "",
                        })
                      }
                      className="text-sm text-[var(--brand)] underline"
                    >
                      Edit this catalog item, change its category or add a category
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">
              Or free-text description
            </span>
            <input
              value={addDescription}
              onChange={(e) => {
                setAddDescription(e.target.value);
                if (e.target.value) {
                  setAddProductId("");
                  setAddServiceId("");
                }
                if (pickCatalogId) {
                  setPickCatalogId("");
                  setCatalogEdit(null);
                }
              }}
              placeholder="Custom item…"
              className={fieldClass}
            />
          </label>
          {!addProductId && !addServiceId ? (
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Text kind</span>
              <select
                value={addTextKind}
                onChange={(e) =>
                  setAddTextKind(e.target.value as AvTextLineKind)
                }
                className={fieldClass}
              >
                <option value="rental">Rental</option>
                <option value="sale">Sale</option>
              </select>
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Unit $</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={addUnitPrice}
              onChange={(e) => setAddUnitPrice(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Qty</span>
            <input
              type="number"
              min={0.01}
              step="any"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">Section</span>
            <select
              value={addGroupId}
              onChange={(e) => setAddGroupId(e.target.value)}
              className={fieldClass}
            >
              <option value="">None</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              disabled={pending || !canAddLine}
              className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add line
            </button>
          </div>
        </form>

        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {lines.length === 0 && groups.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No lines yet.
            </li>
          ) : (
            flatItems.map((item) => {
              if (item.type === "header") {
                return (
                  <li key={`g-${item.id ?? "none"}`} className="bg-[var(--surface)] px-4 py-2">
                    {item.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          key={item.name}
                          defaultValue={item.name}
                          aria-label="Section name"
                          className="h-9 min-w-[10rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-semibold"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v || v === item.name) return;
                            const fd = new FormData();
                            fd.set("id", item.id!);
                            fd.set("opportunity_id", opportunity.id);
                            fd.set("name", v);
                            run(() => renameOpportunityGroupAction(fd));
                          }}
                        />
                        <span className="text-xs text-[var(--muted)]">{money(item.total)}</span>
                        {(["up", "down"] as const).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            disabled={pending || (dir === "up" ? item.index === 0 : item.index === item.count - 1)}
                            aria-label={`Move section ${dir}`}
                            onClick={() => {
                              const fd = new FormData();
                              fd.set("id", item.id!);
                              fd.set("opportunity_id", opportunity.id);
                              fd.set("direction", dir);
                              run(() => moveOpportunityGroupAction(fd));
                            }}
                            className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs disabled:opacity-40"
                          >
                            {dir === "up" ? "▲" : "▼"}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm font-semibold">No section</span>
                    )}
                  </li>
                );
              }
              const line = item.line;
              const product = line.product_id
                ? productById.get(line.product_id)
                : null;
              const isAccessory = Boolean(line.parent_line_id);
              const isFreeText = !line.product_id && !line.service_id;
              const short =
                product &&
                product.kind !== "package" &&
                !isCumulativePackageName(product.name) &&
                opportunity.gear_starts_at && opportunity.gear_ends_at
                  ? shortageForLine({
                      qtyNeeded: Number(line.qty),
                      qtyOwned: Number(product.qty_owned),
                      bufferPct: Number(product.buffer_pct),
                      startsAt: opportunity.gear_starts_at,
                      endsAt: opportunity.gear_ends_at,
                      holds,
                      excludeOpportunityId: opportunity.id,
                      turnaroundHours: Number(product.turnaround_hours) || 0,
                    })
                  : null;
              const real = lineTotal({
                qty: Number(line.qty),
                unitPrice: Number(line.unit_price),
                discountPct: Number(line.discount_pct),
              });
              const custUnit = customerUnitPrice(
                Number(line.unit_price),
                Number(header.venue_markup_pct) || 0,
                header.venue_markup_enabled,
              );
              return (
                <li
                  key={line.id}
                  className={`px-4 py-3 ${isAccessory ? "bg-[var(--background)]/40 pl-8 sm:pl-12" : ""}`}
                >
                  {!isAccessory ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      {(["up", "down"] as const).map((dir) => (
                        <button
                          key={dir}
                          type="button"
                          disabled={pending}
                          aria-label={`Move item ${dir}`}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("id", line.id);
                            fd.set("opportunity_id", opportunity.id);
                            fd.set("direction", dir);
                            run(() => moveOpportunityLineAction(fd));
                          }}
                          className="h-8 rounded-lg border border-[var(--border)] px-2"
                        >
                          {dir === "up" ? "▲" : "▼"}
                        </button>
                      ))}
                      <select
                        aria-label="Move to section"
                        value=""
                        disabled={pending}
                        onChange={(e) => {
                          const fd = new FormData();
                          fd.set("id", line.id);
                          fd.set("opportunity_id", opportunity.id);
                          fd.set("group_id", e.target.value === "__none__" ? "" : e.target.value);
                          if (e.target.value) run(() => moveOpportunityLineToGroupAction(fd));
                        }}
                        className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2"
                      >
                        <option value="">Move to section…</option>
                        {sortedGroups
                          .filter((g) => g.id !== line.group_id)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        {line.group_id ? <option value="__none__">No section</option> : null}
                      </select>
                      {(childCount.get(line.id) ?? 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPackages((cur) => {
                              const next = new Set(cur);
                              if (next.has(line.id)) next.delete(line.id);
                              else next.add(line.id);
                              return next;
                            })
                          }
                          className="h-8 rounded-lg border border-[var(--border)] px-2"
                        >
                          {openPackages.has(line.id) ? "▾ Hide" : "▸ Show"} {childCount.get(line.id)} item
                          {childCount.get(line.id) === 1 ? "" : "s"} inside · {money(childTotal.get(line.id) ?? 0)}
                        </button>
                      ) : null}
                      {(() => {
                        if (!line.product_id) return null;
                        const nested = nestedProductIds.get(line.id);
                        const choices = optionalAccessories.filter(
                          (o) =>
                            o.parent_product_id === line.product_id &&
                            !nested?.has(o.child_product_id),
                        );
                        if (choices.length === 0) return null;
                        return (
                          <select
                            aria-label="Add optional item"
                            value=""
                            disabled={pending}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const fd = new FormData();
                              fd.set("line_id", line.id);
                              fd.set("opportunity_id", opportunity.id);
                              fd.set("child_product_id", e.target.value);
                              run(() => addOptionalPackageItemAction(fd));
                            }}
                            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2"
                          >
                            <option value="">
                              Add optional item… ({choices.length})
                            </option>
                            {choices.map((o) => (
                              <option
                                key={o.child_product_id}
                                value={o.child_product_id}
                              >
                                {o.name} · {money(o.price)}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  ) : null}
                  <form
                    className="grid gap-2 sm:grid-cols-12 sm:items-end"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      fd.set("id", line.id);
                      fd.set("opportunity_id", opportunity.id);
                      run(() => updateOpportunityLineAction(fd));
                    }}
                  >
                    <label
                      className={`block text-sm ${isFreeText ? "sm:col-span-3" : "sm:col-span-4"}`}
                    >
                      <span className="mb-1 block text-[var(--muted)]">
                        {isAccessory ? "Accessory" : "Description"}
                      </span>
                      <input
                        name="description"
                        defaultValue={line.description}
                        className={fieldClass}
                      />
                    </label>
                    {isFreeText ? (
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-[var(--muted)]">
                          Text kind
                        </span>
                        <select
                          name="text_kind"
                          defaultValue={line.text_kind ?? "rental"}
                          className={fieldClass}
                        >
                          <option value="rental">Rental</option>
                          <option value="sale">Sale</option>
                        </select>
                      </label>
                    ) : null}
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block text-[var(--muted)]">Qty</span>
                      <input
                        name="qty"
                        type="number"
                        min={0.01}
                        step="any"
                        defaultValue={line.qty}
                        className={fieldClass}
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block text-[var(--muted)]">
                        Real unit
                      </span>
                      <input
                        name="unit_price"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={line.unit_price}
                        className={fieldClass}
                      />
                    </label>
                    <label className="block text-sm sm:col-span-1">
                      <span className="mb-1 block text-[var(--muted)]">
                        Disc %
                      </span>
                      <input
                        name="discount_pct"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        defaultValue={line.discount_pct}
                        className={fieldClass}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs font-medium"
                      >
                        Save
                      </button>
                      {!isAccessory &&
                      product?.kind === "package" &&
                      !isCumulativePackageName(product.name) ? (
                        <button
                          type="button"
                          disabled={pending}
                          title="Set package unit from Comes-with items and zero accessory prices"
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("id", line.id);
                            fd.set("opportunity_id", opportunity.id);
                            run(() =>
                              repricePackageLineFromAccessoriesAction(fd),
                            );
                          }}
                          className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs font-medium"
                        >
                          Price from items
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", line.id);
                          fd.set("opportunity_id", opportunity.id);
                          run(() => deleteOpportunityLineAction(fd));
                        }}
                        className="h-9 rounded-lg px-2 text-xs text-red-700 dark:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </form>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Line {money(real)}
                    {isFreeText
                      ? ` · text ${line.text_kind ?? "rental"}`
                      : ""}
                    {header.venue_markup_enabled
                      ? ` · customer unit ${money(custUnit)}`
                      : ""}
                    {short && short.shortage > 0 ? (
                      <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
                        Shortage {short.shortage} (free {short.free})
                      </span>
                    ) : short ? (
                      <span className="ml-2 text-emerald-700 dark:text-emerald-300">
                        OK · free {short.free}
                      </span>
                    ) : null}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <VenuePlanPanel
        opportunityId={opportunity.id}
        roomPhotos={roomPhotos}
        planMarkers={planMarkers}
        renders={renders}
        lines={lines}
        loadError={venuePlanError}
        geminiConfigured={geminiConfigured}
      />

      <aside className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">Totals</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Lines</dt>
            <dd>{money(prices.linesSubtotal)}</dd>
          </div>
          {prices.surchargeAmount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Surcharge</dt>
              <dd>{money(prices.surchargeAmount)}</dd>
            </div>
          ) : null}
          {prices.discountAmount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Discount</dt>
              <dd>-{money(prices.discountAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-medium">
            <dt>Real total</dt>
            <dd>{money(prices.realTotal)}</dd>
          </div>
          {header.venue_markup_enabled && prices.venueMarkupAmount > 0 ? (
            <div className="flex justify-between text-[var(--muted)]">
              <dt>Venue markup inside that total (only you see this)</dt>
              <dd>{money(prices.venueMarkupAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-semibold">
            <dt>Customer total</dt>
            <dd>{money(prices.customerTotal)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {holdCount > 0
            ? `${holdCount} hold${holdCount === 1 ? "" : "s"} on this estimate.`
            : "No gear reserved yet."}
          {" · "}
          <Link
            href={`/rentals/crew?opportunity=${opportunity.id}`}
            className="text-[var(--brand)] hover:underline"
          >
            Crew on this job ({crewCount})
          </Link>
        </p>
      </aside>

      {finance ? (
        <QuoteCostsPanel
          opportunityId={opportunity.id}
          finance={finance}
          costs={costs}
          suppliers={suppliers}
        />
      ) : null}

      <QuoteChangeOrdersPanel
        opportunityId={opportunity.id}
        changeOrders={changeOrders}
        changeOrderLinesByCoId={changeOrderLinesByCoId}
        quoteLines={lines.map((l) => ({
          id: l.id,
          description: l.description,
          qty: l.qty,
          unit_price: l.unit_price,
        }))}
      />

      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">Discussion</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Staff notes on this estimate (not shown on the customer estimate).
        </p>
        <ul className="mt-3 space-y-2">
          {discussionNotes.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">No notes yet.</li>
          ) : (
            discussionNotes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {n.author_name || "Staff"} ·{" "}
                  {new Date(n.created_at).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}{" "}
                  ET
                </p>
              </li>
            ))
          )}
        </ul>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const body = String(fd.get("body") ?? "");
            run(async () => {
              const result = await addOpportunityNoteAction(
                opportunity.id,
                body,
              );
              if (result.ok) e.currentTarget.reset();
              return result;
            });
          }}
        >
          <textarea
            name="body"
            rows={2}
            required
            placeholder="Add a staff note…"
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={pending}
            className="mt-2 h-9 rounded-lg border border-[var(--border)] px-3 text-sm disabled:opacity-50"
          >
            Add note
          </button>
        </form>
      </section>
    </AvErpPage>
  );
}
