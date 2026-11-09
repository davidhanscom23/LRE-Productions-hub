"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { guestAccessAction } from "@/app/guest/actions";
import { AuthBackToLogin, authInputClass } from "@/components/auth/auth-shell";

export function GuestAccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await guestAccessAction({ code, next });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo ?? "/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor="guest-code"
          className="block text-sm font-medium text-[var(--foreground)]"
        >
          Access code
        </label>
        <input
          id="guest-code"
          name="code"
          type="password"
          autoComplete="off"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={authInputClass}
          placeholder="Enter guest access code"
        />
      </div>

      <button
        type="submit"
        disabled={pending || !code.trim()}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Entering…" : "Enter Hub"}
      </button>

      <AuthBackToLogin />
    </form>
  );
}
