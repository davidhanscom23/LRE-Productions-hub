"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Briefcase,
  Building,
  Calendar,
  Car,
  CheckCircle2,
  ChevronDown,
  Cigarette,
  DollarSign,
  FileText,
  Heart,
  Lock,
  Mail,
  Pencil,
  Phone,
  Pill,
  Printer,
  Search,
  Server,
  Share2,
  Shield,
  Swords,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { signHandbookAction } from "@/app/(app)/staff-handbook/actions";
import { BrandLogo } from "@/components/brand-logo";
import {
  HandbookAckRoster,
  type HandbookRosterRow,
} from "@/components/handbook/handbook-ack-roster";
import { HandbookEditor } from "@/components/handbook/handbook-editor";
import { HandbookRichText } from "@/components/handbook/handbook-rich-text";
import { HandbookSignaturePad } from "@/components/handbook/handbook-signature-pad";
import type {
  HandbookBlock,
  HandbookContent,
  HandbookIconName,
} from "@/lib/handbook/content";
import { filterHandbookSections } from "@/lib/handbook/match-sections";

const ICON_MAP: Record<HandbookIconName, LucideIcon> = {
  Briefcase,
  Heart,
  Calendar,
  DollarSign,
  Users,
  Phone,
  Mail,
  Server,
  Share2,
  Shield,
  Zap,
  Building,
  Car,
  Cigarette,
  Pill,
  Swords,
  Lock,
  FileText,
};

type HandbookPageClientProps = {
  content: HandbookContent;
  isDraft: boolean;
  isAdmin: boolean;
  canTrackAcks?: boolean;
  alreadySigned: boolean;
  defaultName: string;
  defaultEmail: string;
  rosterRevision?: string;
  rosterRows?: HandbookRosterRow[];
};

function BlockView({ block }: { block: HandbookBlock }) {
  return (
    <div className="mb-4 last:mb-0">
      {block.heading ? (
        <h4 className="mb-1 font-semibold text-[var(--foreground)]">
          {block.heading}
        </h4>
      ) : null}
      {block.paragraphs?.map((paragraph, index) => (
        <p key={index} className="mb-3 leading-relaxed">
          <HandbookRichText text={paragraph} />
        </p>
      ))}
      {block.items ? (
        <ul className="mb-4 list-disc space-y-1 pl-5">
          {block.items.map((item, index) => (
            <li key={index}>
              <HandbookRichText text={item} />
            </li>
          ))}
        </ul>
      ) : null}
      {block.footnote ? (
        <p className="text-sm text-[var(--muted)]">{block.footnote}</p>
      ) : null}
    </div>
  );
}

export function HandbookPageClient({
  content: initialContent,
  isDraft: initialDraft,
  isAdmin,
  canTrackAcks = false,
  alreadySigned,
  defaultName,
  defaultEmail,
  rosterRevision = "live",
  rosterRows = [],
}: HandbookPageClientProps) {
  const [content, setContent] = useState(initialContent);
  const [isDraft, setIsDraft] = useState(initialDraft);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(alreadySigned);
  const [pending, startTransition] = useTransition();

  const browserLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "";
    return navigator.userAgent.slice(0, 80);
  }, []);

  const trimmedQuery = query.trim();
  const matchingSections = useMemo(
    () => filterHandbookSections(content.sections, trimmedQuery),
    [content.sections, trimmedQuery],
  );
  const searching = trimmedQuery.length > 0;

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data: { ip?: string }) => setIpAddress(data.ip ?? null))
      .catch(() => setIpAddress(null));
  }, []);

  function toggleSection(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setOpenIds(new Set(content.sections.map((section) => section.id)));
  }

  function collapseAll() {
    setOpenIds(new Set());
  }

  function handleSubmit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await signHandbookAction({
        signerName: fullName,
        signerEmail: email,
        signatureData,
        ipAddress,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSigned(true);
      setMessage("Handbook acknowledged. Your signature has been recorded.");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/documents"
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          ← Back to Documents
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              <Pencil className="h-4 w-4" />
              {editing ? "Preview" : "Edit handbook"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {editing && isAdmin ? (
        <HandbookEditor
          initialContent={content}
          isDraft={isDraft}
          onCancel={() => setEditing(false)}
          onSaved={(nextContent, nextDraft) => {
            setContent(nextContent);
            setIsDraft(nextDraft);
          }}
        />
      ) : null}

      {isDraft ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Draft — admin only</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Staff cannot see this handbook until an admin publishes it. Use{" "}
            <span className="font-medium">Edit handbook</span> to update copy,
            Save, then Publish for all staff.
          </p>
        </div>
      ) : null}

      {canTrackAcks ? (
        <HandbookAckRoster
          revision={rosterRevision}
          isDraft={isDraft}
          rows={rosterRows}
        />
      ) : null}

      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLogo className="h-16 w-auto object-contain sm:h-20" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {content.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{content.subtitle}</p>
        </div>
      </div>

      {signed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              You have already acknowledged this handbook
              {isDraft ? " (draft revision)" : ""}.
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="space-y-4 text-sm leading-relaxed text-[var(--foreground)]">
          {content.introduction.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <div className="rounded-lg border border-[var(--brand)]/15 bg-[var(--brand-soft)]/50 p-4 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
              Our Mission
            </p>
            <p className="text-sm italic text-[var(--foreground)]">
              {content.mission}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:p-3">
        <div className="print:hidden space-y-2 px-2 pb-2 pt-1 sm:px-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search handbook sections…"
              aria-label="Search handbook sections"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            />
          </label>
          {!searching ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              >
                Collapse all
              </button>
            </div>
          ) : null}
        </div>
        {searching && matchingSections.length === 0 ? (
          <div className="px-3 py-8 text-center sm:px-4">
            <p className="font-medium text-[var(--foreground)]">
              No sections match “{trimmedQuery}”
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Try another keyword, or clear the search to browse all sections.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {matchingSections.map((section) => {
              const Icon = ICON_MAP[section.icon] ?? FileText;
              const open = searching || openIds.has(section.id);
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (searching) return;
                      toggleSection(section.id);
                    }}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-[var(--surface-hover)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-semibold text-[var(--foreground)]">
                      {section.title}
                    </span>
                    <ChevronDown
                      className={[
                        "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
                        open ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>
                  {open ? (
                    <div className="px-3 pb-4 pl-14 text-sm text-[var(--muted)]">
                      {section.blocks.map((block, index) => (
                        <BlockView key={index} block={block} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-soft)]/40 p-5 text-center sm:p-6">
        <FileText className="mx-auto mb-2 h-6 w-6 text-[var(--brand)]" />
        <p className="text-sm font-medium text-[var(--foreground)]">
          {content.acknowledgment}
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {content.companyLine}
          <br />
          {content.ownerLine}
        </p>
      </section>

      {!signed ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Digital Signature
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            By signing below, you acknowledge that you have read, fully
            understand, and agree to adhere to all policies outlined in this
            handbook.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full Name *"
              required
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div className="mt-4">
            <HandbookSignaturePad
              onChange={(signedPad, dataUrl) => {
                setHasSigned(signedPad);
                setSignatureData(dataUrl);
              }}
            />
          </div>

          <div className="mt-4 space-y-1 rounded-lg border border-[var(--border)] bg-[var(--background)]/60 p-3">
            <p className="text-xs font-medium text-[var(--foreground)]">
              Signing Details
            </p>
            <p className="text-xs text-[var(--muted)]">
              Date &amp; Time: {new Date().toLocaleString()}
            </p>
            {ipAddress ? (
              <p className="text-xs text-[var(--muted)]">
                IP Address: {ipAddress}
              </p>
            ) : null}
            {browserLabel ? (
              <p className="text-xs text-[var(--muted)]">
                Browser: {browserLabel}…
              </p>
            ) : null}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
            By clicking &quot;Sign &amp; Acknowledge Handbook&quot; below, I
            acknowledge that this constitutes a legally binding electronic
            signature in accordance with the U.S. Electronic Signatures in Global
            and National Commerce Act (E-SIGN Act) and the Uniform Electronic
            Transactions Act (UETA). My IP address, timestamp, and browser
            information will be recorded.
          </p>

          {error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
              {message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !fullName.trim() || !hasSigned}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--banner)] px-4 py-3 text-sm font-semibold text-[var(--banner-fg)] transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {pending ? "Submitting…" : "Sign & Acknowledge Handbook"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
