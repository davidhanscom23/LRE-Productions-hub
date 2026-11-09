"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PresenceUser = {
  id: string;
  name: string;
  color?: string | null;
};

type Props = {
  userId: string;
  name: string;
  color?: string | null;
};

/**
 * Realtime "who's online" pill for the top bar. Uses Supabase Realtime
 * presence (ephemeral — no table). The dot color scales with how many
 * teammates are online.
 */
export function OnlinePresence({ userId, name, color }: Props) {
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase.channel("hub-online", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const byId = new Map<string, PresenceUser>();
        for (const metas of Object.values(state)) {
          const meta = metas[0];
          if (meta?.id) byId.set(meta.id, meta);
        }
        setOnline([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ id: userId, name, color: color ?? null });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, name, color]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const count = online.length;
  const others = Math.max(0, count - 1);

  const tone = useMemo(() => {
    // Color scales with how many teammates (besides you) are online.
    if (others <= 0)
      return { dot: "#9ca3af", label: "text-[var(--muted)]" }; // gray — just you
    if (others <= 2)
      return { dot: "#22c55e", label: "text-[var(--foreground)]" }; // green
    if (others <= 5)
      return { dot: "#10b981", label: "text-[var(--foreground)]" }; // emerald
    return { dot: "#f59e0b", label: "text-[var(--foreground)]" }; // amber — lots online
  }, [others]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-hover)]"
        aria-label={`${count} online`}
        title={`${count} online`}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: tone.dot, boxShadow: `0 0 6px ${tone.dot}` }}
        />
        <span className={tone.label}>{count}</span>
        <Users className="h-3.5 w-3.5 text-[var(--muted)]" />
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Online now · {count}
          </p>
          <ul className="mt-1 max-h-64 space-y-0.5 overflow-auto">
            {online.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--foreground)]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: u.color || "#22c55e" }}
                />
                <span className="truncate">
                  {u.id === userId ? `${u.name} (you)` : u.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
