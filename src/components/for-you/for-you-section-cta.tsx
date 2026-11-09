"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { dismissForYouKeyAction } from "@/app/(app)/for-you/actions";

type ForYouSectionCtaProps = {
  href: string;
  cta: string;
  tone: "brand" | "amber";
  /** When set, clicking dismisses this For You card then navigates. */
  dismissKey?: string | null;
};

export function ForYouSectionCta({
  href,
  cta,
  tone,
  dismissKey,
}: ForYouSectionCtaProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const className = [
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50",
    tone === "amber"
      ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
      : "bg-[var(--brand-soft)] text-[var(--brand)]",
  ].join(" ");

  if (!dismissKey) {
    return (
      <Link href={href} className={className}>
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          await dismissForYouKeyAction(dismissKey);
          router.push(href);
          router.refresh();
        });
      }}
    >
      {pending ? "Opening…" : cta}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}
