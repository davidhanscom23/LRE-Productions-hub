"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ExternalLink,
  FileText,
  Monitor,
  Pencil,
} from "lucide-react";
import { updateOnboardingResourceUrlAction } from "@/app/(app)/people/actions";
import {
  hasOnboardingUrl,
  ONBOARDING_DRIVE_URL,
  type OnboardingResource,
} from "@/lib/people/onboarding";
import type { Department, UserRole } from "@/lib/types/database";

type OnboardingPanelProps = {
  resources: OnboardingResource[];
  isAdmin: boolean;
  viewerDepartments: Department[];
  viewerRole: UserRole;
};

function iconForResource(resource: OnboardingResource) {
  const slug = resource.slug.toLowerCase();
  if (slug.includes("interview") || slug.includes("question")) return FileText;
  if (slug.includes("office")) return Building2;
  if (
    slug.includes("audiovisual") ||
    slug.startsWith("av-") ||
    slug.includes("-av")
  ) {
    return Monitor;
  }
  return FileText;
}

function viewerIntro(departments: Department[]): string {
  if (departments.length === 0) {
    return "You have no departments assigned yet — ask an admin to add your department(s) so the right forms appear.";
  }
  if (departments.length === 1) {
    return `Showing onboarding forms for your ${departments[0]} department.`;
  }
  return `Showing onboarding forms for your departments: ${departments.join(", ")}.`;
}

export function OnboardingPanel({
  resources,
  isAdmin,
  viewerDepartments,
  viewerRole,
}: OnboardingPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManageLinks = isAdmin;
  const showDeptIntro = viewerRole === "staff" || viewerRole === "trainer";

  const missingCount = useMemo(
    () => resources.filter((resource) => !hasOnboardingUrl(resource)).length,
    [resources],
  );

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm text-[var(--muted)]">
        New-hire forms. Links open in Google Workspace.
        {canManageLinks
          ? " Admins can paste Form/Sheet/Doc URLs on each card. Interview Questions - AV stays admin-only."
          : ""}
        {showDeptIntro ? ` ${viewerIntro(viewerDepartments)}` : ""}
      </p>

      {canManageLinks && missingCount > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">
            {missingCount === 1
              ? "1 onboarding link still needs a URL"
              : `${missingCount} onboarding links still need URLs`}
          </p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Staff and Leads only see department forms after you paste a
            Google link. Use{" "}
            <span className="font-medium">Add link</span> on each card below
            (copy from{" "}
            <a
              href={ONBOARDING_DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:opacity-90"
            >
              LRE Google Drive
            </a>{" "}
            / Google Forms). Interview Questions - AV stays visible to admins
            only.
          </p>
        </div>
      ) : null}

      {resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-12 text-center">
          <p className="font-medium text-[var(--foreground)]">
            No onboarding forms for your departments yet
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ask an admin to assign your department(s) and paste the Google
            Form/Sheet links on People → Onboarding.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((resource) => {
            const Icon = iconForResource(resource);
            const hasUrl = hasOnboardingUrl(resource);
            return (
              <article
                key={resource.id}
                className={[
                  "flex flex-col rounded-2xl border bg-[var(--surface)] p-5 shadow-sm",
                  hasUrl
                    ? "border-[var(--border)]"
                    : "border-dashed border-amber-300/80 dark:border-amber-700/80",
                ].join(" ")}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold text-[var(--foreground)]">
                  {resource.title}
                </h3>
                <p className="mt-1 flex-1 text-sm text-[var(--muted)]">
                  {resource.description}
                </p>

                {editingId === resource.id ? (
                  <EditUrlForm
                    resource={resource}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {hasUrl ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-sm text-amber-800 dark:text-amber-200">
                        URL missing — staff cannot see this card yet
                      </span>
                    )}
                    {canManageLinks && (
                      <button
                        type="button"
                        onClick={() => setEditingId(resource.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {hasUrl ? "Edit link" : "Add link"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditUrlForm({
  resource,
  onDone,
}: {
  resource: OnboardingResource;
  onDone: () => void;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(resource.url);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOnboardingResourceUrlAction({
        id: resource.id,
        url,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://docs.google.com/…"
        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
      />
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded-lg px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
