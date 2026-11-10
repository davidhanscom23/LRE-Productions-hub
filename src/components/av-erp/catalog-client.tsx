"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  createProductAction,
  createProductGroupAction,
  createServiceAction,
  duplicateProductAction,
  duplicateServiceAction,
  deleteServiceAction,
  removeProductAccessoryAction,
  updateProductAction,
  updateServiceAction,
  upsertProductAccessoryAction,
} from "@/app/(app)/rentals/catalog/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import {
  AV_OWNER_COMPANIES,
  ownerCompanyLabel,
  type AvOwnerCompany,
  type AvProduct,
  type AvProductAccessory,
  type AvProductGroup,
  type AvProductKind,
  type AvService,
  type AvServiceKind,
} from "@/lib/av-erp/types";

type Props = {
  products: AvProduct[];
  services: AvService[];
  groups: AvProductGroup[];
  accessories: AvProductAccessory[];
};

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function CatalogClient({
  products,
  services,
  groups,
  accessories,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "services">("products");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const productFormRef = useRef<HTMLFormElement>(null);
  const productNameRef = useRef<HTMLInputElement>(null);
  const serviceFormRef = useRef<HTMLFormElement>(null);
  const serviceNameRef = useRef<HTMLInputElement>(null);

  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AvProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    code: "",
    description: "",
    kind: "rental" as AvProductKind,
    group_id: "",
    rental_price: "0",
    qty_owned: "0",
    owner_company: "vident" as AvOwnerCompany,
    buffer_pct: "0",
    turnaround_hours: "0",
    replacement_charge: "",
    is_active: true,
  });
  const [addAccessoryId, setAddAccessoryId] = useState("");
  const [addAccessoryQty, setAddAccessoryQty] = useState("1");
  const [addAccessoryOptional, setAddAccessoryOptional] = useState(false);
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(
    null,
  );
  const [editAccessoryQty, setEditAccessoryQty] = useState("1");
  const [editAccessoryOptional, setEditAccessoryOptional] = useState(false);

  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<AvService | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    code: "",
    description: "",
    kind: "fee" as AvServiceKind,
    unit_price: "0",
    is_active: true,
  });

  const [groupName, setGroupName] = useState("");

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) m.set(g.id, g.name);
    return m;
  }, [groups]);

  const productNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, p.name);
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!showInactive && !p.is_active) return false;
      if (!q) return true;
      return [p.name, p.code, groupNameById.get(p.group_id ?? "") ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [products, query, showInactive, groupNameById]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (!showInactive && !s.is_active) return false;
      if (!q) return true;
      return [s.name, s.code, s.kind].join(" ").toLowerCase().includes(q);
    });
  }, [services, query, showInactive]);

  useEffect(() => {
    if (!productFormOpen) return;
    productFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.setTimeout(() => productNameRef.current?.focus(), 50);
  }, [productFormOpen, editingProduct?.id]);

  useEffect(() => {
    if (!serviceFormOpen) return;
    serviceFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.setTimeout(() => serviceNameRef.current?.focus(), 50);
  }, [serviceFormOpen, editingService?.id]);

  function openNewProduct() {
    setEditingProduct(null);
    setProductForm({
      name: "",
      code: "",
      description: "",
      kind: "rental",
      group_id: groups[0]?.id ?? "",
      rental_price: "0",
      qty_owned: "0",
      owner_company: "vident" as AvOwnerCompany,
      buffer_pct: "0",
      turnaround_hours: "0",
      replacement_charge: "",
      is_active: true,
    });
    setAddAccessoryId("");
    setAddAccessoryQty("1");
    setAddAccessoryOptional(false);
    setEditingAccessoryId(null);
    setError(null);
    setProductFormOpen(true);
  }

  function openEditProduct(p: AvProduct) {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      code: p.code,
      description: p.description,
      kind: p.kind,
      group_id: p.group_id ?? "",
      rental_price: String(p.rental_price),
      qty_owned: String(p.qty_owned),
      owner_company: p.owner_company ?? "vident",
      buffer_pct: String(p.buffer_pct),
      turnaround_hours: String(p.turnaround_hours),
      replacement_charge:
        p.replacement_charge != null ? String(p.replacement_charge) : "",
      is_active: p.is_active,
    });
    setAddAccessoryId("");
    setAddAccessoryQty("1");
    setAddAccessoryOptional(false);
    setEditingAccessoryId(null);
    setError(null);
    setProductFormOpen(true);
  }

  function submitProduct(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(productForm).forEach(([k, v]) => {
      if (typeof v === "boolean") fd.set(k, v ? "on" : "off");
      else fd.set(k, v);
    });
    if (editingProduct) fd.set("id", editingProduct.id);
    startTransition(async () => {
      const result = editingProduct
        ? await updateProductAction(fd)
        : await createProductAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProductFormOpen(false);
      router.refresh();
    });
  }

  function startEditAccessory(a: AvProductAccessory) {
    setEditingAccessoryId(a.id);
    setEditAccessoryQty(String(a.qty));
    setEditAccessoryOptional(Boolean(a.is_optional));
  }

  function saveAccessoryEdit(a: AvProductAccessory) {
    if (!editingProduct) return;
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("parent_product_id", editingProduct.id);
    fd.set("child_product_id", a.child_product_id);
    fd.set("qty", editAccessoryQty);
    fd.set("is_optional", editAccessoryOptional ? "on" : "off");
    startTransition(async () => {
      const result = await upsertProductAccessoryAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingAccessoryId(null);
      router.refresh();
    });
  }

  function addAccessory() {
    if (!editingProduct || !addAccessoryId) return;
    const fd = new FormData();
    fd.set("parent_product_id", editingProduct.id);
    fd.set("child_product_id", addAccessoryId);
    fd.set("qty", addAccessoryQty || "1");
    fd.set("is_optional", addAccessoryOptional ? "on" : "off");
    startTransition(async () => {
      const result = await upsertProductAccessoryAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAddAccessoryId("");
      setAddAccessoryQty("1");
      setAddAccessoryOptional(false);
      router.refresh();
    });
  }

  function removeAccessory(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const result = await removeProductAccessoryAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function duplicateProduct(p: AvProduct) {
    startTransition(async () => {
      setError(null);
      const result = await duplicateProductAction(p.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function openNewService() {
    setEditingService(null);
    setServiceForm({
      name: "",
      code: "",
      description: "",
      kind: "fee",
      unit_price: "0",
      is_active: true,
    });
    setError(null);
    setServiceFormOpen(true);
  }

  function openEditService(s: AvService) {
    setEditingService(s);
    setServiceForm({
      name: s.name,
      code: s.code,
      description: s.description,
      kind: s.kind,
      unit_price: String(s.unit_price),
      is_active: s.is_active,
    });
    setError(null);
    setServiceFormOpen(true);
  }

  function submitService(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(serviceForm).forEach(([k, v]) => {
      if (typeof v === "boolean") fd.set(k, v ? "on" : "off");
      else fd.set(k, v);
    });
    if (editingService) fd.set("id", editingService.id);
    startTransition(async () => {
      const result = editingService
        ? await updateServiceAction(fd)
        : await createServiceAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setServiceFormOpen(false);
      router.refresh();
    });
  }

  function deleteService(s: AvService) {
    if (
      !window.confirm(
        `Delete "${s.name}" from the catalog? Existing estimates and invoices keep their lines. This cannot be undone. To just hide it, mark it inactive instead.`,
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("id", s.id);
    startTransition(async () => {
      const result = await deleteServiceAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (editingService?.id === s.id) setServiceFormOpen(false);
      router.refresh();
    });
  }

  function duplicateService(s: AvService) {
    startTransition(async () => {
      setError(null);
      const result = await duplicateServiceAction(s.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function submitGroup(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", groupName);
    startTransition(async () => {
      const result = await createProductGroupAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setGroupName("");
      router.refresh();
    });
  }

  const parentAccessories = editingProduct
    ? accessories.filter((a) => a.parent_product_id === editingProduct.id)
    : [];

  const accessoryChoices = editingProduct
    ? products.filter(
        (p) =>
          p.id !== editingProduct.id &&
          p.is_active &&
          !parentAccessories.some((a) => a.child_product_id === p.id),
      )
    : [];

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Catalog
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Products, packages, and services owned by the Hub (KM-style). Current
            RMS remains the live stock source until cutover.
          </p>
        </div>
        <button
          type="button"
          onClick={tab === "products" ? openNewProduct : openNewService}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {tab === "products" ? "Add product" : "Add service"}
        </button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["products", "Products"],
            ["services", "Services"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search catalog"
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {tab === "products" ? (
        <>
          <form
            onSubmit={submitGroup}
            className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[var(--border)] p-3"
          >
            <label className="block min-w-[12rem] flex-1 text-sm">
              <span className="mb-1 block text-[var(--muted)]">
                New section / group
              </span>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Speakers"
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={pending || !groupName.trim()}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-medium disabled:opacity-50"
            >
              Add section
            </button>
          </form>

          {productFormOpen ? (
            <form
              ref={productFormRef}
              onSubmit={submitProduct}
              className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <h2 className="text-sm font-semibold">
                {editingProduct ? "Edit product" : "New product"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Name *</span>
                  <input
                    ref={productNameRef}
                    required
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm({ ...productForm, name: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Code</span>
                  <input
                    value={productForm.code}
                    onChange={(e) =>
                      setProductForm({ ...productForm, code: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Kind</span>
                  <select
                    value={productForm.kind}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        kind: e.target.value as AvProductKind,
                      })
                    }
                    className={fieldClass}
                  >
                    <option value="rental">Rental</option>
                    <option value="package">Package (no stock)</option>
                    <option value="sale">Sale</option>
                    <option value="consumable">Consumable</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Section</span>
                  <select
                    value={productForm.group_id}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        group_id: e.target.value,
                      })
                    }
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
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">
                    Rental price
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={productForm.rental_price}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        rental_price: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Qty owned</span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={productForm.qty_owned}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        qty_owned: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Owned by</span>
                  <select
                    value={productForm.owner_company}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        owner_company: e.target.value as AvOwnerCompany,
                      })
                    }
                    className={fieldClass}
                  >
                    {AV_OWNER_COMPANIES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Buffer %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={productForm.buffer_pct}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        buffer_pct: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">
                    Turnaround (hours)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={productForm.turnaround_hours}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        turnaround_hours: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">
                    Description
                  </span>
                  <textarea
                    rows={2}
                    value={productForm.description}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        description: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              {editingProduct ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={productForm.is_active}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        is_active: e.target.checked,
                      })
                    }
                  />
                  Active
                </label>
              ) : null}

              {editingProduct ? (
                <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                  <h3 className="text-sm font-semibold">Comes with</h3>
                  <p className="text-xs text-[var(--muted)]">
                    Nested gear added automatically when this product goes on an
                    estimate. Items marked Optional are not added; staff pick
                    them from the package line on the estimate.
                  </p>
                  {parentAccessories.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      Nothing nested yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {parentAccessories.map((a) => {
                        const editing = editingAccessoryId === a.id;
                        return (
                          <li
                            key={a.id}
                            className="flex flex-wrap items-end gap-2 rounded-md bg-[var(--background)] p-2"
                          >
                            <div className="min-w-[10rem] flex-1 text-sm">
                              {productNameById.get(a.child_product_id) ??
                                "Unknown"}
                            </div>
                            {editing ? (
                              <>
                                <label className="block w-20 text-xs">
                                  <span className="mb-1 block text-[var(--muted)]">
                                    Qty
                                  </span>
                                  <input
                                    type="number"
                                    min={0.01}
                                    step="0.01"
                                    value={editAccessoryQty}
                                    onChange={(e) =>
                                      setEditAccessoryQty(e.target.value)
                                    }
                                    className={fieldClass}
                                  />
                                </label>
                                <label className="flex items-center gap-1.5 pb-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={editAccessoryOptional}
                                    onChange={(e) =>
                                      setEditAccessoryOptional(e.target.checked)
                                    }
                                  />
                                  Optional
                                </label>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => saveAccessoryEdit(a)}
                                  className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs font-medium disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingAccessoryId(null)}
                                  className="h-9 rounded-lg px-2 text-xs"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="pb-2 text-xs text-[var(--muted)]">
                                  qty {a.qty}
                                  {a.is_optional ? " · optional (add by hand)" : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => startEditAccessory(a)}
                                  className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => removeAccessory(a.id)}
                                  className="h-9 rounded-lg px-2 text-xs font-medium text-red-700 disabled:opacity-50 dark:text-red-300"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-2">
                    <label className="block min-w-[10rem] flex-1 text-xs">
                      <span className="mb-1 block text-[var(--muted)]">
                        Add item
                      </span>
                      <select
                        value={addAccessoryId}
                        onChange={(e) => setAddAccessoryId(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Pick product…</option>
                        {accessoryChoices.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block w-20 text-xs">
                      <span className="mb-1 block text-[var(--muted)]">Qty</span>
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={addAccessoryQty}
                        onChange={(e) => setAddAccessoryQty(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 pb-2 text-xs">
                      <input
                        type="checkbox"
                        checked={addAccessoryOptional}
                        onChange={(e) =>
                          setAddAccessoryOptional(e.target.checked)
                        }
                      />
                      Optional
                    </label>
                    <button
                      type="button"
                      disabled={pending || !addAccessoryId}
                      onClick={addAccessory}
                      className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs font-medium disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Save the product first, then you can edit its Comes with list.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setProductFormOpen(false)}
                  className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {filteredProducts.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                No products yet. Add a section, then a product — or load a
                sample shop from Overview.
              </li>
            ) : (
              filteredProducts.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 hover:bg-[var(--surface-hover)]"
                >
                  <button
                    type="button"
                    onClick={() => openEditProduct(p)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium text-[var(--foreground)]">
                      {p.name}
                      {!p.is_active ? (
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {[
                        p.kind,
                        groupNameById.get(p.group_id ?? "") || null,
                        p.code || null,
                        p.kind === "package" ? null : `${p.qty_owned} owned`,
                        p.kind === "package" ? null : ownerCompanyLabel(p.owner_company),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {p.kind !== "package" ? (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {p.last_used_at
                          ? `Last out: ${p.last_used_event || "an event"} · ${
                              p.last_used_by_name || "staff"
                            } · ${new Date(p.last_used_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}`
                          : "Not used on an event yet"}
                      </p>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium">
                      {money(p.rental_price)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditProduct(p)}
                        className="rounded-md px-2 py-0.5 text-xs font-medium text-[var(--brand)] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => duplicateProduct(p)}
                        className="rounded-md px-2 py-0.5 text-xs font-medium text-[var(--muted)] hover:underline disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <>
          {serviceFormOpen ? (
            <form
              ref={serviceFormRef}
              onSubmit={submitService}
              className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <h2 className="text-sm font-semibold">
                {editingService ? "Edit service" : "New service"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Name *</span>
                  <input
                    ref={serviceNameRef}
                    required
                    value={serviceForm.name}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, name: e.target.value })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Kind</span>
                  <select
                    value={serviceForm.kind}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        kind: e.target.value as AvServiceKind,
                      })
                    }
                    className={fieldClass}
                  >
                    <option value="crew">Crew work</option>
                    <option value="transport">Transport</option>
                    <option value="fee">Fee or expense</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">
                    Unit price
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={serviceForm.unit_price}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        unit_price: e.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              {editingService ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={serviceForm.is_active}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        is_active: e.target.checked,
                      })
                    }
                  />
                  Active
                </label>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setServiceFormOpen(false)}
                  className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {filteredServices.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                No services yet.
              </li>
            ) : (
              filteredServices.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 hover:bg-[var(--surface-hover)]"
                >
                  <button
                    type="button"
                    onClick={() => openEditService(s)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-[var(--muted)]">{s.kind}</p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium">
                      {money(s.unit_price)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditService(s)}
                        className="rounded-md px-2 py-0.5 text-xs font-medium text-[var(--brand)] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => duplicateService(s)}
                        className="rounded-md px-2 py-0.5 text-xs font-medium text-[var(--muted)] hover:underline disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => deleteService(s)}
                        className="rounded-md px-2 py-0.5 text-xs font-medium text-red-400 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </AvErpPage>
  );
}
