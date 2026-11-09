import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GuestAccessForm } from "@/components/auth/guest-access-form";

export default function GuestAccessPage() {
  return (
    <AuthShell
      title="Guest Access"
      description="Enter the access code to browse the hub in read-only mode."
    >
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-lg bg-[var(--surface-hover)]" />
        }
      >
        <GuestAccessForm />
      </Suspense>
      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Guest mode hides People, Chat, Calendar, field tools, and other
        confidential modules. Staff should sign in with their invite email.
      </p>
    </AuthShell>
  );
}
