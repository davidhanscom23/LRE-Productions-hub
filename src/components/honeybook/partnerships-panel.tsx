"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateProjectStageAction } from "@/app/(app)/honeybook/actions";
import { createPartnershipAction } from "@/app/(app)/honeybook/partnership-actions";
import { AssigneeChips } from "@/components/honeybook/honeybook-assignees";
import {
  groupPartnershipsByStage,
  PARTNER_KINDS,
  PARTNERSHIP_GOLD,
  PARTNERSHIP_STAGES,
} from "@/lib/honeybook/partnerships";
import { colorSoftBackground } from "@/lib/people/color";
import {
  formatHoneyBookMoney,
  type HoneyBookProject,
  type PartnershipFinancials,
} from "@/lib/types/honeybook";

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]";

/** Money shown to admins; blurred placeholder (no real data) for everyone else. */
export function PartnershipMoney({
  isAdmin,
  value,
}: {
  isAdmin: boolean;
  value: number | null | undefined;
}) {
  if (isAdmin) {
    return value != null ? (
      <span className="font-medium">{formatHoneyBookMoney(value)}</span>
    ) : (
      <span className="text-[var(--muted)]">No value set</span>
    );
  }
  return (
    <span
      className="select-none blur-sm"
      aria-label="Financial details are visible to admins only"
      title="Financial details are visible to admins only"
    >
      $00,000
    </span>
  );
}

export function PartnershipsPanel({
  partnerships,
  financials,
  isAdmin,
  canManage,
  currentProfileId,
}: {
  partnerships: HoneyBookProject[];
  financials: Record<string, PartnershipFinancials>;
  isAdmin: boolean;
  canManage: boolean;
  currentProfileId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return partnerships.filter((p) => {
      if (
        onlyMine &&
        !(p.assignees ?? []).some((a) => a.profile_id === currentProfileId)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.partner_kind ?? "").toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.stage.toLowerCase().includes(q)
      );
    });
  }, [partnerships, query, onlyMine, currentProfileId]);

  const groups = useMemo(() => groupPartnershipsByStage(filtered), [filtered]);

  function canEdit(p: HoneyBookProject) {
    return (
      isAdmin ||
      (p.assignees ?? []).some((a) => a.profile_id === currentProfileId)
    );
  }

  function moveTo(p: HoneyBookProject, stage: string) {
    setError(null);
    startTransition(async () => {
      const r = await updateProjectStageAction({ id: p.id, stage });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className={inputCls}
          placeholder="Search partnerships…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          Only mine
        </label>
        {canManage ? (
          <button
            type="button"
            className="h-9 shrink-0 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white hover:opacity-90"
            onClick={() => {
              setError(null);
              setShowNew((v) => !v);
            }}
          >
            {showNew ? "Cancel" : "New partnership"}
          </button>
        ) : null}
      </div>

      {showNew ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            New partnership
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            For venues, vendors, and other partners. It stays off the events
            calendar and out of event counts.
          </p>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              startTransition(async () => {
                const r = await createPartnershipAction({
                  name: String(fd.get("name") ?? ""),
                  partnerKind: String(fd.get("kind") ?? ""),
                  stage: String(fd.get("stage") ?? ""),
                  location: String(fd.get("location") ?? ""),
                  details: String(fd.get("details") ?? ""),
                  dealValue: isAdmin ? String(fd.get("deal") ?? "") : null,
                  financialNotes: isAdmin ? String(fd.get("fin_notes") ?? "") : "",
                });
                if (r.error) {
                  setError(r.error);
                  return;
                }
                setShowNew(false);
                router.refresh();
              });
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Name</span>
              <input name="name" required className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Type</span>
              <select name="kind" className={inputCls} defaultValue="Venue">
                {PARTNER_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Stage</span>
              <select name="stage" className={inputCls} defaultValue="Prospect">
                {PARTNERSHIP_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">
                Location / website
              </span>
              <input name="location" className={inputCls} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">
                Contact and details
              </span>
              <textarea
                name="details"
                rows={3}
                className={`${inputCls} h-auto py-2`}
              />
            </label>
            {isAdmin ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--muted)]">
                    Deal value (admins only)
                  </span>
                  <input name="deal" inputMode="decimal" className={inputCls} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--muted)]">
                    Financial notes (admins only)
                  </span>
                  <input name="fin_notes" className={inputCls} />
                </label>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : "Add partnership"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {partnerships.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          No partnerships yet.
          {canManage ? " Use New partnership to add a venue or vendor." : ""}
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PARTNERSHIP_STAGES.map((stage) => (
            <div
              key={stage}
              className="w-64 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
            >
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {stage}{" "}
                <span className="font-normal">({groups[stage].length})</span>
              </p>
              <div className="space-y-2">
                {groups[stage].map((p) => (
                  <article
                    key={p.id}
                    className="rounded-lg border border-[var(--border)] p-2.5 text-sm"
                    style={{
                      borderLeftWidth: "4px",
                      borderLeftColor: PARTNERSHIP_GOLD,
                      backgroundColor: colorSoftBackground(PARTNERSHIP_GOLD, 0.16),
                    }}
                  >
                    <span
                      className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black"
                      style={{ backgroundColor: PARTNERSHIP_GOLD }}
                    >
                      Partnership · {p.partner_kind || "Other"}
                    </span>
                    <Link
                      href={`/honeybook/projects/${p.id}`}
                      className="mt-1 block font-semibold text-[var(--foreground)] hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.location ? (
                      <p className="text-xs text-[var(--muted)]">{p.location}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--foreground)]">
                      <PartnershipMoney
                        isAdmin={isAdmin}
                        value={financials[p.id]?.dealValue}
                      />
                    </p>
                    <AssigneeChips assignees={p.assignees ?? []} />
                    {canEdit(p) ? (
                      <select
                        className="mt-2 h-8 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                        value={PARTNERSHIP_STAGES.find(
                          (s) => s.toLowerCase() === p.stage.trim().toLowerCase(),
                        ) ?? stage}
                        disabled={pending}
                        onChange={(e) => moveTo(p, e.target.value)}
                        aria-label={`Move ${p.name} to another stage`}
                      >
                        {PARTNERSHIP_STAGES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
