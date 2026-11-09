"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  HOLIDAY_THEMES,
  type HolidayId,
  type HolidayTheme,
} from "@/lib/holidays/holidays";

type HolidayState = {
  id: HolidayId | null;
  /** ?holidayPopup=1 — replay the splash even if already seen. */
  forcePopup: boolean;
};

const HolidayContext = createContext<HolidayState>({
  id: null,
  forcePopup: false,
});

/** Supplies the active holiday skin (if any) to the shell and Home hero. */
export function HolidayProvider({
  id,
  forcePopup = false,
  children,
}: {
  id: HolidayId | null;
  forcePopup?: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ id, forcePopup }), [id, forcePopup]);
  return (
    <HolidayContext.Provider value={value}>{children}</HolidayContext.Provider>
  );
}

/** The active holiday theme, or null on ordinary days. */
export function useHoliday(): HolidayTheme | null {
  const { id } = useContext(HolidayContext);
  return id ? HOLIDAY_THEMES[id] : null;
}

/** Whether the splash should replay regardless of the seen flag. */
export function useHolidayForcePopup(): boolean {
  return useContext(HolidayContext).forcePopup;
}
