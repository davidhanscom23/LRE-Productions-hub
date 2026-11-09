"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createStore } from "@/lib/event-checklist/offline/store";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    // Gear checklists keep a copy on this device for offline use: clear it on sign-out so the
    // next person on a shared tablet does not see it. Warn first if changes have not synced.
    try {
      if (typeof indexedDB !== "undefined") {
        const store = createStore();
        const waiting = await store.countAllOps();
        if (
          waiting > 0 &&
          !window.confirm(
            `${waiting} gear checklist change${waiting === 1 ? " has" : "s have"} not synced yet and will be lost if you sign out. Sign out anyway?`,
          )
        ) {
          return;
        }
        await store.purge();
      }
      navigator.serviceWorker?.controller?.postMessage({ type: "purge-checklists" });
    } catch {
      // never block sign-out
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden md:inline">Sign out</span>
    </button>
  );
}
