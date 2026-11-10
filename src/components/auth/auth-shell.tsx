import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { COMPANY } from "@/lib/company";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--panel-radius)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-8 text-center">
          <BrandLogo
            alt={COMPANY.displayName}
            className="mx-auto mb-5 h-24 w-auto max-w-[14rem] object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthBackToLogin() {
  return (
    <p className="text-center text-sm text-[var(--muted)]">
      <Link
        href="/login"
        className="font-medium text-[var(--brand)] hover:underline"
      >
        Back to sign in
      </Link>
    </p>
  );
}

export const authInputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]";
