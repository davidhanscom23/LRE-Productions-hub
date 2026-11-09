import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to access the team hub"
    >
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-lg bg-[var(--surface-hover)]" />
        }
      >
        <LoginForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        Have an access code?{" "}
        <Link
          href="/guest"
          className="font-medium text-[var(--brand)] hover:underline"
        >
          Guest access
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        New here? Open the invite link in your email first — it will ask you to
        create a password.
      </p>
    </AuthShell>
  );
}
