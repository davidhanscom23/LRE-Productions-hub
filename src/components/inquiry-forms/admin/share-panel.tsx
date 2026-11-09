"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { HUB_COPY } from "@/lib/inquiry-forms/hub-copy";
import { copyWithCheck, type CopyOutcome } from "./share-copy";
import { buildEmbedSnippet, directFormUrl } from "./share-snippet";
import { cls, Notice } from "./list-ui";

export interface SharePanelProps {
  slug: string;
  /** Canonical hub origin from the adapter (never window.location), no trailing slash. */
  publicOrigin: string;
  /** Form status: draft | live | paused | archived. */
  status: string;
}

type Toast = { tone: "good" | "bad"; text: string };

const TOAST_TEXT: Record<"link" | "embed", Record<CopyOutcome, Toast>> = {
  link: {
    verified: { tone: "good", text: "Link copied and checked." },
    copied: { tone: "good", text: "Link copied." },
    failed: { tone: "bad", text: "Copy did not work. Select the link and press Ctrl+C (Cmd+C on a Mac)." },
  },
  embed: {
    verified: { tone: "good", text: "Embed code copied and checked: your clipboard holds the whole snippet." },
    copied: { tone: "good", text: "Embed code copied." },
    failed: { tone: "bad", text: "Copy did not work. The code is selected: press Ctrl+C (Cmd+C on a Mac)." },
  },
};

function statusWarning(status: string): { title: string; body: string } | null {
  switch (status) {
    case "live":
      return null;
    case "draft":
      return {
        title: "This form is not published yet",
        body: "You can paste the code now, but visitors cannot send the form until you publish it from the Build tab.",
      };
    case "paused":
      return {
        title: "This form is paused",
        body: "Visitors who open the link or the embedded form cannot send it until you resume the form.",
      };
    case "archived":
      return {
        title: "This form is archived",
        body: "It does not take inquiries. Restore and resume it from the forms list before you share it.",
      };
    default:
      return { title: "This form is not live", body: "Visitors cannot send it until it is live." };
  }
}

/** Share tab: the direct link and the ONE self-sizing embed snippet, with copy + check. */
export default function SharePanel({ slug, publicOrigin, status }: SharePanelProps) {
  const url = directFormUrl(publicOrigin, slug);
  const snippet = buildEmbedSnippet(publicOrigin, slug);
  const linkRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const linkId = useId();
  const codeId = useId();
  const codeHelpId = useId();
  const warning = statusWarning(status);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function copy(kind: "link" | "embed") {
    const source = kind === "link" ? linkRef.current : codeRef.current;
    const outcome = await copyWithCheck(kind === "link" ? url : snippet, source);
    if (outcome === "failed") source?.select();
    setCopied(outcome === "failed" ? null : kind);
    setToast(TOAST_TEXT[kind][outcome]);
  }

  return (
    <div className="space-y-5">
      {warning ? <Notice tone="warn" title={warning.title}>{warning.body}</Notice> : null}

      <section className={`${cls.card} space-y-3`} aria-labelledby={`${linkId}-title`}>
        <div>
          <h2 id={`${linkId}-title`} className={cls.sectionTitle}>
            Direct link
          </h2>
          <p className={cls.help}>
            For buttons, emails, texts and social posts. It opens the form on its own page.
          </p>
        </div>
        <label htmlFor={linkId} className="sr-only">
          Direct link to the form
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={linkRef}
            id={linkId}
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className={`${cls.input} sm:flex-1`}
          />
          <div className="flex gap-2">
            <button type="button" className={cls.btnSecondary} onClick={() => copy("link")}>
              {copied === "link" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              Copy link
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className={cls.btnSecondary}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </section>

      <section className={`${cls.card} space-y-3`} aria-labelledby={`${codeId}-title`}>
        <div>
          <h2 id={`${codeId}-title`} className={cls.sectionTitle}>
            Embed on your website
          </h2>
          <p id={codeHelpId} className={cls.help}>
            This is the only code you need. The form sizes itself to fit on phones and computers, so do not put
            it inside a box with a fixed height.
          </p>
        </div>
        <label htmlFor={codeId} className="sr-only">
          Embed code
        </label>
        <textarea
          ref={codeRef}
          id={codeId}
          readOnly
          rows={3}
          value={snippet}
          aria-describedby={codeHelpId}
          onFocus={(e) => e.currentTarget.select()}
          className={`${cls.input} resize-none font-mono text-[13px] leading-relaxed`}
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={cls.btnPrimary} onClick={() => copy("embed")}>
            {copied === "embed" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            Copy embed code
          </button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)]">
          <p className="font-semibold">Where to paste it</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              {HUB_COPY.shareSiteBuilder}: add a Custom JS/HTML element where the form should appear and paste the
              code into it.
            </li>
            <li>WordPress: add a Custom HTML block and paste the code into it.</li>
            <li>Use it once per page, in a full-width section. Publish the page, then open it on your phone to check.</li>
            <li>{HUB_COPY.shareTestInquiry}</li>
          </ul>
        </div>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" aria-live="polite" role="status">
        {toast ? (
          <div
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.tone === "good"
                ? "bg-emerald-700 text-white dark:bg-emerald-600"
                : "bg-red-700 text-white dark:bg-red-600"
            }`}
          >
            {toast.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { SharePanel };
