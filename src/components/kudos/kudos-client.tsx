"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import {
  deleteKudosAction,
  giveKudosAction,
} from "@/app/(app)/kudos/actions";
import type { StaffOption } from "@/lib/types/action-items";
import { KUDO_VALUES, kudoValueLabel, type Kudo } from "@/lib/types/kudos";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

export function KudosClient({
  currentUserId,
  isAdmin,
  kudos,
  staff,
}: {
  currentUserId: string;
  isAdmin: boolean;
  kudos: Kudo[];
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toUser, setToUser] = useState("");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const others = staff.filter((s) => s.id !== currentUserId);

  function give() {
    setError(null);
    startTransition(async () => {
      const r = await giveKudosAction({ toUser, message, value });
      if (r.error) { setError(r.error); return; }
      setToUser(""); setValue(""); setMessage("");
      router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm("Delete this kudo?")) return;
    startTransition(async () => {
      const r = await deleteKudosAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Kudos
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Recognize a teammate for great work. Everyone can see the love.
        </p>
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Give kudos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={toUser}
            onChange={(e) => setToUser(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          >
            <option value="">Recognize…</option>
            {others.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
          </select>
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          >
            <option value="">Value (optional)</option>
            {KUDO_VALUES.map((v) => (<option key={v.value} value={v.value}>{v.label}</option>))}
          </select>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="What did they do that was great?"
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <button
          type="button"
          disabled={pending || !toUser || !message.trim()}
          onClick={give}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Heart className="h-4 w-4" /> Give kudos
        </button>
      </Card>

      {kudos.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            No kudos yet — be the first to recognize a teammate.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {kudos.map((k) => (
            <div key={k.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Heart className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {k.from_name} → {k.to_name}
                    </span>
                    {k.value ? (
                      <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]">
                        {kudoValueLabel(k.value)}
                      </span>
                    ) : null}
                    <span className="text-xs text-[var(--muted)]">{fmtDate(k.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--foreground)]/90">{k.message}</p>
                  {k.from_user === currentUserId || isAdmin ? (
                    <button type="button" onClick={() => remove(k.id)} className="mt-1 text-xs text-[var(--muted)] hover:text-red-600">Delete</button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
