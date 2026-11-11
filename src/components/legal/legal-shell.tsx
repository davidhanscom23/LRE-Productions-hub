import Link from "next/link";
import type { ReactNode } from "react";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            href="https://lreproductions.com"
            className="text-lg font-semibold text-[var(--brand)]"
          >
            LRE Productions
          </Link>
          <Link
            href="https://lreproductions.com"
            className="text-sm text-[var(--muted)] hover:underline"
          >
            lreproductions.com
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Last updated: {updated}
        </p>
        <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-[var(--foreground)]">
          {children}
        </div>
      </main>
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-3xl px-6 py-6 text-sm text-[var(--muted)]">
          <p>LRE Productions, Inc. · Tiverton, RI</p>
          <p className="mt-1">
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/sms-terms" className="hover:underline">
              SMS Terms
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
