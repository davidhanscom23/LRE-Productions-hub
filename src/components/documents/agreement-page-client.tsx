"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  Lightbulb,
  Lock,
  Megaphone,
  Pencil,
  Scale,
  Search,
  Shield,
  Sparkles,
  Target,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { signDocumentAction } from "@/app/(app)/documents/actions";
import { BrandLogo } from "@/components/brand-logo";
import { AgreementEditor } from "@/components/documents/agreement-editor";
import {
  HandbookAckRoster,
  type HandbookRosterRow,
} from "@/components/handbook/handbook-ack-roster";
import { HandbookRichText } from "@/components/handbook/handbook-rich-text";
import { HandbookSignaturePad } from "@/components/handbook/handbook-signature-pad";
import type { HandbookBlock } from "@/lib/handbook/content";
import type {
  AgreementContent,
  DocumentIconName,
} from "@/lib/documents/types";

const ICON_MAP: Record<DocumentIconName, LucideIcon> = {
  Briefcase,
  Scale,
  DollarSign,
  AlertTriangle,
  Wrench,
  Shield,
  Users,
  Clock,
  Megaphone,
  FileText,
  Camera,
  Lock,
  Target,
  BookOpen,
  Lightbulb,
  Sparkles,
  ClipboardList,
};

type AgreementPageClientProps = {
  content: AgreementContent;
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

export function AgreementPageClient({
  content: initialContent,
  isDraft: initialDraft,
  isAdmin,
  canTrackAcks = false,
  alreadySigned,
  defaultName,
  defaultEmail,
  rosterRevision = "live",
  rosterRows = [],
}: AgreementPageClientProps) {
  const [content, setContent] = useState(initialContent);
  const [isDraft, setIsDraft] = useState(initialDraft);
  const [editing, setEditing] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [signed, setSigned] = useState(alreadySigned);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [browserLabel] = useState(() =>
    typeof navigator !== "undefined"
      ? navigator.userAgent.slice(0, 80)
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data: { ip?: string }) => {
        if (!cancelled) setIpAddress(data.ip ?? null);
      })
      .catch(() => {
        if (!cancelled) setIpAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const matchingSections = useMemo(() => {
    if (!searching) return content.sections;
    return content.sections.filter((section) => {
      const haystack = [
        section.title,
        ...section.blocks.flatMap((b) => [
          b.heading ?? "",
          ...(b.paragraphs ?? []),
          ...(b.items ?? []),
          b.footnote ?? "",
        ]),
      ]
        .join("\n")
        .toLowerCase();
      return haystack.includes(trimmedQuery);
    });
  }, [content.sections, searching, trimmedQuery]);

  function toggleSection(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await signDocumentAction({
        documentKey: content.key,
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
      setMessage("Agreement signed. Thank you.");
    });
  }

  if (editing && isAdmin) {
    return (
      <AgreementEditor
        documentKey={content.key}
        initialContent={content}
        isDraft={isDraft}
        onCancel={() => setEditing(false)}
        onSaved={(next, draftFlag) => {
          setContent(next);
          setIsDraft(draftFlag);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/documents"
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          ← Back to Documents
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {isDraft ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              Draft — admin only
            </span>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="text-center">
        <BrandLogo className="mx-auto h-10 w-auto" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {content.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{content.subtitle}</p>
      </div>

      {signed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              You have already signed this agreement
              {isDraft ? " (draft revision)" : ""}.
            </p>
          </div>
        </div>
      ) : null}

      {canTrackAcks && rosterRows.length > 0 ? (
        <HandbookAckRoster
          revision={rosterRevision}
          isDraft={isDraft}
          rows={rosterRows}
        />
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="space-y-4 text-sm leading-relaxed text-[var(--foreground)]">
          {content.introduction.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:p-3">
        <div className="space-y-2 px-2 pb-2 pt-1 sm:px-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sections…"
              aria-label="Search agreement sections"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            />
          </label>
        </div>
        {searching && matchingSections.length === 0 ? (
          <div className="px-3 py-8 text-center sm:px-4">
            <p className="font-medium text-[var(--foreground)]">
              No sections match “{trimmedQuery}”
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
            By signing below, you agree to the terms of this agreement.
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
            <p className="mt-1 text-xs text-[var(--muted)]">
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
            By clicking &quot;{content.signButtonLabel}&quot; below, I acknowledge
            that this constitutes a legally binding electronic signature in
            accordance with the U.S. Electronic Signatures in Global and National
            Commerce Act (E-SIGN Act) and the Uniform Electronic Transactions Act
            (UETA). My IP address, timestamp, and browser information will be
            recorded.
          </p>

          {error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
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
            {pending ? "Submitting…" : content.signButtonLabel}
          </button>
        </section>
      ) : null}
    </div>
  );
}
