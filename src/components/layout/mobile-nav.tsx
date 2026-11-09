"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error("useMobileNav must be used within MobileNavProvider");
  }
  return ctx;
}

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(onStoreChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getServerDesktopSnapshot() {
  return true;
}

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );
  const [open, setOpen] = useState(true);
  const [syncedDesktop, setSyncedDesktop] = useState(true);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Keep drawer open state aligned with viewport breakpoint changes.
  if (isDesktop !== syncedDesktop) {
    setSyncedDesktop(isDesktop);
    setOpen(isDesktop);
  }

  // Close the drawer after navigation on small screens only.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (!isDesktop) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    // Lock body scroll only for the mobile overlay drawer
    if (!isDesktop) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, isDesktop]);

  return (
    <MobileNavContext.Provider
      value={{
        open,
        setOpen,
        toggle: () => setOpen((value) => !value),
      }}
    >
      {children}
    </MobileNavContext.Provider>
  );
}
