import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Lock } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGuestRole } from "@/lib/auth/guest";
import { DOCUMENT_CATALOG } from "@/lib/documents/catalog";
import { listAgreementDraftFlags } from "@/lib/documents/settings";
import {
  canViewStaffHandbook,
  getHandbookDocument,
} from "@/lib/handbook/settings";
import { redirect } from "next/navigation";

export default async function DocumentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (isGuestRole(profile.role)) redirect("/");

  const isAdmin = profile.role === "admin";
  const showHandbook = await canViewStaffHandbook(isAdmin);
  const handbook = showHandbook || isAdmin ? await getHandbookDocument() : null;
  const draftFlags = await listAgreementDraftFlags();

  const cards = DOCUMENT_CATALOG.flatMap((entry) => {
    if (entry.kind === "handbook") {
      if (!showHandbook) return [];
      return [
        {
          ...entry,
          isDraft: Boolean(handbook?.isDraft),
        },
      ];
    }

    const isDraft = entry.agreementKey
      ? draftFlags[entry.agreementKey]
      : true;
    if (isDraft && !isAdmin) return [];
    return [
      {
        ...entry,
        isDraft,
      },
    ];
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Documents
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Documents
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Staff Handbook and company agreements. Admins can keep each agreement
          as a draft, edit the copy, then publish when ready — same flow as the
          handbook.
        </p>
      </header>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No published documents yet. Admins can open drafts from this page after
          migration 089.
        </p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => {
            const Icon = card.kind === "handbook" ? BookOpen : FileText;
            return (
              <li key={card.key}>
                <Link
                  href={card.href}
                  className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-hover)]"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-[var(--foreground)]">
                        {card.title}
                      </h2>
                      {card.isDraft ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                          <Lock className="h-3 w-3" />
                          Draft
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {card.description}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--muted)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin ? (
        <p className="text-xs text-[var(--muted)]">
          Tip: open a draft agreement → Edit → save updates → Publish for all
          staff. Until published, only admins can open it.
        </p>
      ) : null}
    </div>
  );
}
