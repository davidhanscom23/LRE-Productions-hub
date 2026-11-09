"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/client";

function nextPathForAuthType(type: string | null) {
  if (type === "invite" || type === "signup") {
    return "/set-password";
  }
  if (type === "recovery") {
    return "/reset-password";
  }
  return "/";
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your invite…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const typeParam = url.searchParams.get("type");
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const type = typeParam || hashParams.get("type");
      const next = nextPathForAuthType(type);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setMessage("This invite link is invalid or expired.");
          router.replace("/login?error=auth");
          return;
        }
        router.replace(next);
        router.refresh();
        return;
      }

      if (tokenHash && typeParam) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: typeParam as "invite" | "recovery" | "signup" | "email",
        });
        if (cancelled) return;
        if (error) {
          setMessage("This invite link is invalid or expired.");
          router.replace("/login?error=auth");
          return;
        }
        router.replace(nextPathForAuthType(typeParam));
        router.refresh();
        return;
      }

      // Implicit / hash-based redirects (access_token in URL hash)
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error || !data.session) {
        setMessage("This invite link is invalid or expired.");
        router.replace("/login?error=auth");
        return;
      }

      router.replace(next);
      router.refresh();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <BrandLogo className="mx-auto mb-4 h-10 w-auto object-contain" />
        <p className="text-sm text-[var(--muted)]">{message}</p>
      </div>
    </div>
  );
}
