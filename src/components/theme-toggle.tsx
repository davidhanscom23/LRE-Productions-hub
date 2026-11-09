"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { saveThemePreferenceAction } from "@/app/(app)/appearance/actions";
import {
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from "@/lib/theme/preference";

const OPTION_ICONS: Record<
  ThemePreference,
  React.ComponentType<{ className?: string }>
> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const emptySubscribe = () => () => {};

type AppearanceMenuProps = {
  /** Saved account preference from the server (null if unset / pre-migration). */
  preferredTheme?: ThemePreference | null;
};

export function AppearanceMenu({
  preferredTheme = null,
}: AppearanceMenuProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const syncedRef = useRef(false);
  const menuId = useId();

  // Apply the account preference once after mount so it follows the user
  // across devices (localStorage is still updated by next-themes).
  useEffect(() => {
    if (!mounted || syncedRef.current || !preferredTheme) return;
    syncedRef.current = true;
    if (theme !== preferredTheme) {
      setTheme(preferredTheme);
    }
  }, [mounted, preferredTheme, setTheme, theme]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
        aria-label="Appearance"
      />
    );
  }

  const selected = (THEME_PREFERENCES.includes(theme as ThemePreference)
    ? theme
    : preferredTheme ?? "system") as ThemePreference;
  const TriggerIcon =
    selected === "system"
      ? resolvedTheme === "dark"
        ? Moon
        : Sun
      : OPTION_ICONS[selected];

  function choose(next: ThemePreference) {
    setTheme(next);
    setOpen(false);
    startTransition(async () => {
      await saveThemePreferenceAction(next);
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        aria-label="Appearance"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Appearance"
      >
        <TriggerIcon className="h-4 w-4" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Appearance"
          className="absolute top-full right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
            Appearance
          </p>
          {THEME_PREFERENCES.map((option) => {
            const Icon = OPTION_ICONS[option];
            const active = selected === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={pending && active}
                onClick={() => choose(option)}
                className={[
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-[var(--brand-soft)]/55 text-[var(--brand)]"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span className="flex-1">{THEME_PREFERENCE_LABELS[option]}</span>
                {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
          <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
            System follows your device setting.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use AppearanceMenu — kept as a thin alias for older imports. */
export function ThemeToggle({
  preferredTheme = null,
}: AppearanceMenuProps) {
  return <AppearanceMenu preferredTheme={preferredTheme} />;
}
