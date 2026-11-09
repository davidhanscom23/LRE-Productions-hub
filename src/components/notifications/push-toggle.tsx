"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushToggle() {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [supported, setSupported] = useState(true);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      const ok =
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        typeof window !== "undefined" &&
        "PushManager" in window;
      if (cancelled) return;
      setSupported(ok);
      if (!ok) {
        // On iOS, web push only works from a home-screen-installed PWA, not a
        // Safari tab — so guide the user to install it rather than dead-ending.
        const ua = navigator.userAgent || "";
        const isIOS =
          /iphone|ipad|ipod/i.test(ua) ||
          (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true;
        setNeedsInstall(isIOS && !standalone);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setEnabled(Boolean(sub));
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (busy) return;
    if (!vapid) {
      setMsg("Push notifications aren't configured on the server yet.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications are blocked — enable them in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const json = sub.toJSON();
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (r.ok) {
        setEnabled(true);
        setMsg("On — this device will get push alerts.");
      } else {
        setMsg("Couldn't save the subscription. Try again.");
      }
    } catch {
      setMsg("Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch {
      setMsg("Couldn't turn it off.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)]">
            <BellRing className="h-5 w-5 text-[var(--brand)]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Push notifications on this device
            </p>
            <p className="text-sm text-[var(--muted)]">
              Get alerts on your phone or computer — huddles, texts, and more —
              even when the hub isn&apos;t open.
            </p>
          </div>
        </div>
        {supported ? (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={() => (enabled ? void disable() : void enable())}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              enabled ? "bg-[var(--brand)]" : "bg-[var(--surface-hover)]"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        ) : null}
      </div>
      {!supported ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {needsInstall
            ? "On iPhone, add the hub to your Home Screen (Share → Add to Home Screen), then open it from there — push notifications only work from the installed app on iOS."
            : "Push notifications aren’t supported in this browser."}
        </p>
      ) : null}
      {msg ? <p className="mt-2 text-xs text-[var(--muted)]">{msg}</p> : null}
    </section>
  );
}
