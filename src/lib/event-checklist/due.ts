import type { ChecklistPass } from "./types";

/** Alerts only fire for a time that passed recently; older ones are stale and stay quiet. */
export const ALERT_WINDOW_HOURS = 12;
/** The in-app popup keeps showing for longer so nobody who opens the Hub late misses it. */
export const POPUP_WINDOW_HOURS = 48;

/** True when `dueAt` has passed, but not longer ago than `windowHours`. */
export function isDueNow(
  now: Date,
  dueAt: string | null | undefined,
  windowHours: number = ALERT_WINDOW_HOURS,
): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return false;
  const age = now.getTime() - due;
  return age >= 0 && age <= windowHours * 3_600_000;
}

/** True when `dueAt` passed so long ago the alert would only be noise. */
export function isStale(
  now: Date,
  dueAt: string | null | undefined,
  windowHours: number = ALERT_WINDOW_HOURS,
): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  return Number.isFinite(due) && now.getTime() - due > windowHours * 3_600_000;
}

export function passLabel(pass: ChecklistPass): string {
  return pass === "out" ? "out of the warehouse" : "back in the warehouse";
}

export function alertTitle(pass: ChecklistPass, eventName: string, percent: number): string {
  return `Gear ${percent}% ${pass === "out" ? "checked out" : "checked back in"}: ${eventName}`;
}

export function alertBody(
  pass: ChecklistPass,
  percent: number,
  remainingItems: number,
): string {
  const items = `${remainingItems} item${remainingItems === 1 ? "" : "s"} still not ${
    pass === "out" ? "checked out" : "checked back in"
  }`;
  return `The scheduled time for gear ${passLabel(pass)} has passed and the checklist is at ${percent}%. ${items}.`;
}

/** Short text message (kept under one SMS segment where possible). */
export function alertSms(
  pass: ChecklistPass,
  eventName: string,
  percent: number,
  url: string,
): string {
  const name = eventName.length > 60 ? `${eventName.slice(0, 57)}...` : eventName;
  return `LRE: gear ${pass === "out" ? "out of" : "back into"} the warehouse for ${name} is only ${percent}% checked. Open the checklist: ${url}`;
}
