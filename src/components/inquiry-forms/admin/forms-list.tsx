"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings2,
  Share2,
  Trash2,
} from "lucide-react";
import {
  deleteForm,
  duplicateForm,
  setFormStatus,
} from "@/app/(app)/inquiry-forms/actions";
import { formatEasternTimestamp } from "@/lib/inquiry-forms/dates";
import { HUB_COPY } from "@/lib/inquiry-forms/hub-copy";
import { FunnelTiles } from "./funnel-tiles";
import {
  FORM_STATUS_LABEL,
  FORM_STATUS_TONE,
  addStats,
  emptyStats,
  formatCount,
  formatPercent,
  percentOf,
} from "./list-helpers";
import { NewFormDialog, type BrandOption } from "./list-new-form-dialog";
import type { FormListRow, StarterFormSummary } from "./list-types";
import { Chip, cls, Notice, PageHeader } from "./list-ui";
import { StarterFormsCard } from "./starter-forms-card";

type Flash = { tone: "good" | "bad"; text: string; href?: string; linkText?: string };

export interface FormsListProps {
  forms: FormListRow[];
  brands: BrandOption[];
  defaultBrand: string;
  starters: StarterFormSummary[];
}

/** The /inquiry-forms page body: header, 30-day totals, starter forms (empty state) and one row per form. */
export function FormsList({ forms, brands, defaultBrand, starters }: FormsListProps) {
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const brandByKey = useMemo(() => new Map(brands.map((b) => [b.key, b])), [brands]);
  const active = forms.filter((f) => f.status !== "archived");
  const archived = forms.filter((f) => f.status === "archived");
  const totals = active.reduce((acc, f) => addStats(acc, f.stats30d), emptyStats());

  function run(
    id: string,
    action: () => Promise<{ ok: boolean; error?: string; id?: string }>,
    onOk: (res: { ok: boolean; error?: string; id?: string }) => Flash | null,
  ) {
    setFlash(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await action();
        setFlash(res.ok ? onOk(res) : { tone: "bad", text: res.error || "That did not work. Please try again." });
      } catch {
        setFlash({ tone: "bad", text: "Could not reach the Hub. Check your connection and try again." });
      } finally {
        setBusyId(null);
      }
    });
  }

  function pause(f: FormListRow) {
    if (!window.confirm(`Pause "${f.name}"? Visitors will see that it is not taking inquiries until you resume it.`)) return;
    run(f.id, () => setFormStatus(f.id, "paused"), () => ({ tone: "good", text: `"${f.name}" is paused.` }));
  }

  function resume(f: FormListRow) {
    run(f.id, () => setFormStatus(f.id, "live"), () => ({ tone: "good", text: `"${f.name}" is live again.` }));
  }

  function archive(f: FormListRow) {
    if (
      !window.confirm(
        `Archive "${f.name}"? It stops taking inquiries and moves to the Archived list. Its submissions stay.`,
      )
    )
      return;
    run(f.id, () => setFormStatus(f.id, "archived"), () => ({ tone: "good", text: `"${f.name}" is archived.` }));
  }

  function restore(f: FormListRow) {
    run(
      f.id,
      () => setFormStatus(f.id, "paused"),
      () => ({
        tone: "good",
        text:
          f.publishedVersion === null
            ? `"${f.name}" is back as a draft.`
            : `"${f.name}" is back and paused. Resume it when you want visitors to use it.`,
      }),
    );
  }

  function duplicate(f: FormListRow) {
    run(
      f.id,
      () => duplicateForm(f.id),
      (res) => ({
        tone: "good",
        text: `Copied "${f.name}" as a new draft.`,
        href: res.id ? `/inquiry-forms/${res.id}` : undefined,
        linkText: "Open the copy",
      }),
    );
  }

  function remove(f: FormListRow) {
    if (!window.confirm(`Delete "${f.name}" for good? This cannot be undone.`)) return;
    run(f.id, () => deleteForm(f.id), () => ({ tone: "good", text: `"${f.name}" was deleted.` }));
  }

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <PageHeader
        title="Inquiry Forms"
        description={HUB_COPY.formsListDescription}
        actions={
          <>
            <Link href="/inquiry-forms/settings" className={cls.btnSecondary}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Business settings
            </Link>
            <button type="button" className={cls.btnPrimary} onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New form
            </button>
          </>
        }
      />

      <div aria-live="polite" className="empty:hidden mb-4">
        {flash ? (
          <Notice tone={flash.tone}>
            <span>{flash.text}</span>
            {flash.href ? (
              <>
                {" "}
                <Link href={flash.href} className="font-semibold underline underline-offset-2">
                  {flash.linkText ?? "Open"}
                </Link>
              </>
            ) : null}
          </Notice>
        ) : null}
      </div>

      {forms.length === 0 ? (
        <StarterFormsCard
          starters={starters}
          onAdded={(names) =>
            setFlash({
              tone: "good",
              text: names.length
                ? `Added ${names.join(" and ")}. Open a form and use its Share tab to put it on your website.`
                : "The starter forms were already here.",
            })
          }
        />
      ) : (
        <div className="space-y-5">
          <FunnelTiles
            caption="All active forms, last 30 days"
            views={totals.views}
            starts={totals.starts}
            completes={totals.completes}
          />

          <section aria-labelledby="forms-heading" className="space-y-3">
            <h2 id="forms-heading" className={cls.sectionTitle}>
              Forms ({active.length})
            </h2>
            {active.length === 0 ? (
              <p className={cls.help}>Every form is archived. Use New form or restore one below.</p>
            ) : (
              <ul className="space-y-3">
                {active.map((f) => (
                  <FormRowItem
                    key={f.id}
                    form={f}
                    brand={brandByKey.get(f.brand)}
                    busy={busyId === f.id}
                    onPause={() => pause(f)}
                    onResume={() => resume(f)}
                    onDuplicate={() => duplicate(f)}
                    onArchive={() => archive(f)}
                  />
                ))}
              </ul>
            )}
          </section>

          {archived.length > 0 ? (
            <section aria-labelledby="archived-heading" className="space-y-3">
              <h2 id="archived-heading" className={cls.sectionTitle}>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-left hover:underline"
                  aria-expanded={showArchived}
                  aria-controls="archived-forms"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  Archived ({archived.length}) {showArchived ? "- hide" : "- show"}
                </button>
              </h2>
              {showArchived ? (
                <ul id="archived-forms" className="space-y-3">
                  {archived.map((f) => (
                    <FormRowItem
                      key={f.id}
                      form={f}
                      brand={brandByKey.get(f.brand)}
                      busy={busyId === f.id}
                      onRestore={() => restore(f)}
                      onDuplicate={() => duplicate(f)}
                      onDelete={() => remove(f)}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      {showNew ? (
        <NewFormDialog brands={brands} defaultBrand={defaultBrand} onClose={() => setShowNew(false)} />
      ) : null}
    </div>
  );
}

function FormRowItem({
  form: f,
  brand,
  busy,
  onPause,
  onResume,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: {
  form: FormListRow;
  brand: BrandOption | undefined;
  busy: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}) {
  const s = f.stats30d;
  const conversion = percentOf(s.completes, s.views);
  const published = f.publishedVersion !== null;

  return (
    <li className={`${cls.card} space-y-3`} aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/inquiry-forms/${f.id}`}
              className="text-base font-semibold text-[var(--foreground)] underline-offset-2 hover:underline"
            >
              {f.name}
            </Link>
            <Chip tone="neutral" title="Brand">
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                style={{ backgroundColor: brand?.accentColor ?? "#9ca3af" }}
                aria-hidden="true"
              />
              {brand?.name ?? f.brand}
            </Chip>
            <Chip tone={FORM_STATUS_TONE[f.status]}>{FORM_STATUS_LABEL[f.status]}</Chip>
            <span className="text-sm text-[var(--muted)]">
              {published ? `Version ${f.publishedVersion}` : "Not published yet"}
            </span>
          </div>
          <p className="break-all text-sm text-[var(--muted)]">/inquire/{f.slug}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Views (30 days)" value={formatCount(s.views)} />
        <Stat label="Starts" value={formatCount(s.starts)} />
        <Stat label="Completes" value={formatCount(s.completes)} />
        <Stat label="Conversion" value={formatPercent(conversion)} />
        <div className="col-span-2">
          <dt className="text-[var(--muted)]">Last inquiry</dt>
          <dd className="font-medium text-[var(--foreground)]">
            {f.lastSubmissionAt ? formatEasternTimestamp(f.lastSubmissionAt) : "None yet"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link href={`/inquiry-forms/${f.id}`} className={cls.btnSmall} aria-label={`Edit ${f.name}`}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </Link>
        {f.status !== "archived" ? (
          <Link href={`/inquiry-forms/${f.id}?tab=share`} className={cls.btnSmall} aria-label={`Share ${f.name}`}>
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Share
          </Link>
        ) : null}
        {f.status === "live" && onPause ? (
          <button type="button" className={cls.btnSmall} onClick={onPause} disabled={busy} aria-label={`Pause ${f.name}`}>
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            Pause
          </button>
        ) : null}
        {f.status === "paused" && onResume ? (
          <button
            type="button"
            className={cls.btnSmall}
            onClick={onResume}
            disabled={busy || !published}
            title={published ? undefined : "Publish the form first"}
            aria-label={`Resume ${f.name}`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Resume
          </button>
        ) : null}
        {f.status === "draft" ? (
          <span className="inline-flex min-h-9 items-center text-xs text-[var(--muted)]">
            Publish it from the editor to take inquiries.
          </span>
        ) : null}
        {onDuplicate ? (
          <button type="button" className={cls.btnSmall} onClick={onDuplicate} disabled={busy} aria-label={`Duplicate ${f.name}`}>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Duplicate
          </button>
        ) : null}
        {onArchive ? (
          <button type="button" className={cls.btnSmall} onClick={onArchive} disabled={busy} aria-label={`Archive ${f.name}`}>
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Archive
          </button>
        ) : null}
        {onRestore ? (
          <button type="button" className={cls.btnSmall} onClick={onRestore} disabled={busy} aria-label={`Restore ${f.name}`}>
            <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
            Restore
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" className={cls.btnDangerSmall} onClick={onDelete} disabled={busy} aria-label={`Delete ${f.name}`}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        ) : null}
        {busy ? (
          <span className="inline-flex min-h-9 items-center text-xs text-[var(--muted)]" role="status">
            Working on it...
          </span>
        ) : null}
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="font-medium tabular-nums text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

export default FormsList;
