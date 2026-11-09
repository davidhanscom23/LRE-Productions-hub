"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDocumentTemplateAction,
  saveDefaultSalesTaxRateAction,
  updateDocumentTemplateAction,
} from "@/app/(app)/rentals/templates/actions";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import type { AvDocumentTemplate } from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Props = {
  templates: AvDocumentTemplate[];
  defaultSalesTaxRatePct?: number;
};

export function TemplatesClient({
  templates,
  defaultSalesTaxRatePct = 0,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AvDocumentTemplate | null>(null);

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(async () => {
      const result = await createDocumentTemplateAction(fd);
      if (result.ok) e.currentTarget.reset();
      return result;
    });
  }

  return (
    <AvErpPage maxWidthClassName="max-w-3xl">
      <h1 className="text-xl font-semibold">Document templates</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Terms and boilerplate for estimates and invoices. The default estimate
        template prints on the public estimate page.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => saveDefaultSalesTaxRateAction(fd));
        }}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">
            Default sales tax rate (%)
          </span>
          <input
            name="tax_rate_pct"
            type="number"
            min={0}
            max={100}
            step="0.0001"
            defaultValue={defaultSalesTaxRatePct}
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold disabled:opacity-50"
        >
          Save tax rate
        </button>
        <p className="w-full text-xs text-[var(--muted)]">
          Used when drafting invoices (customers marked Tax exempt get 0%). You
          can still override the rate on a draft invoice.
        </p>
      </form>

      <form
        onSubmit={onCreate}
        className="mt-4 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Name</span>
          <input name="name" required className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Kind</span>
          <select name="kind" defaultValue="estimate" className={fieldClass}>
            <option value="estimate">Estimate</option>
            <option value="invoice">Invoice</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Terms</span>
          <textarea name="terms" rows={5} className={fieldClass} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_default" />
          Default for this kind
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add template
        </button>
      </form>

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {templates.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No templates yet.
          </li>
        ) : (
          templates.map((t) => (
            <li key={t.id} className="px-4 py-3">
              {editing?.id === t.id ? (
                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("id", t.id);
                    run(() => updateDocumentTemplateAction(fd));
                  }}
                >
                  <input
                    name="name"
                    defaultValue={t.name}
                    required
                    className={fieldClass}
                  />
                  <select
                    name="kind"
                    defaultValue={t.kind}
                    className={fieldClass}
                  >
                    <option value="estimate">Estimate</option>
                    <option value="invoice">Invoice</option>
                    <option value="other">Other</option>
                  </select>
                  <textarea
                    name="terms"
                    rows={5}
                    defaultValue={t.terms}
                    className={fieldClass}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="is_default"
                      defaultChecked={t.is_default}
                    />
                    Default for this kind
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={t.is_active}
                    />
                    Active
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {t.name}{" "}
                      <span className="text-xs font-normal text-[var(--muted)]">
                        ({t.kind}
                        {t.is_default ? " · default" : ""}
                        {!t.is_active ? " · inactive" : ""})
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
                      {t.terms.trim() || "No terms yet."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="text-sm text-[var(--brand)] hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </AvErpPage>
  );
}
