import { SetPasswordForm } from "@/components/auth/set-password-form";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#F8E8E0_0%,_transparent_55%),linear-gradient(180deg,_#f4f6f8_0%,_#e8eef2_100%)] dark:bg-[radial-gradient(ellipse_at_top,_#3D1F14_0%,_transparent_50%),linear-gradient(180deg,_#0c1217_0%,_#101820_100%)]"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-8 shadow-[0_20px_50px_-28px_rgba(20,33,43,0.35)] backdrop-blur">
        <div className="mb-8 text-center">
          <BrandLogo
            className="mx-auto mb-4 h-12 w-auto max-w-[14rem] object-contain"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Create your password
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Welcome to LRE Productions Hub. Choose a password to finish setting
            up your account.
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">{user.email}</p>
        </div>

        <SetPasswordForm />
      </div>
    </div>
  );
}
