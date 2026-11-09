"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { X } from "lucide-react";
import { HOLIDAY_THEMES, type HolidayId } from "@/lib/holidays/holidays";

const VISIBLE_MS = 5000;
const FADE_MS = 450;
const SEEN_KEY = "vident-hub-holiday-popup-seen";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

type Props = {
  id: HolidayId;
  /** YYYY-MM-DD America/New_York, so the splash shows once per holiday per browser. */
  dateKey: string;
  /** Show even if already seen (?holidayPopup=1 previews). */
  force?: boolean;
};

/**
 * Home-only holiday splash: the holiday photo, greeting and a warm line.
 * Auto-fades after ~5s or dismiss via X. Once per holiday per browser.
 */
export function HolidayPopup({ id, dateKey, force = false }: Props) {
  const theme = HOLIDAY_THEMES[id];
  const storageKey = `${SEEN_KEY}:${id}:${dateKey}`;

  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [fading, setFading] = useState(false);
  const closedRef = useRef(false);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setFading(true);
    window.setTimeout(() => {
      writeFlag(storageKey, true);
      setOpen(false);
    }, FADE_MS);
  }, [storageKey]);

  useEffect(() => {
    if (!mounted) return;
    if (!force && readFlag(storageKey)) return;
    closedRef.current = false;
    // Defer open so we don't setState synchronously inside the effect body.
    const start = window.setTimeout(() => setOpen(true), 0);
    const auto = window.setTimeout(() => close(), VISIBLE_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(auto);
    };
  }, [storageKey, close, mounted, force]);

  if (!mounted || !open) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm transition-opacity duration-[450ms] ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={theme.greeting}
      onClick={close}
    >
      <div
        className={`hl-popup-card relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 px-8 py-14 text-center text-white shadow-2xl transition-all duration-[450ms] ${
          fading ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,.38), rgba(0,0,0,.55)), url(/holidays/${id}.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85">
          {theme.name}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">
          {theme.greeting}
        </p>
        <p className="mt-3 text-sm text-white/90">{theme.subline}</p>
      </div>
    </div>
  );
}
