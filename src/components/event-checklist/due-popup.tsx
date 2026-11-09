"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Due = {
  checklistId: string;
  projectId: string;
  name: string;
  pass: "out" | "back";
  dueAt: string;
  percent: number;
  remainingItems: number;
};

const key = (d: Due) => `gear-popup:${d.checklistId}:${d.pass}:${d.dueAt}`;

function dismissed(d: Due): boolean {
  try {
    return localStorage.getItem(key(d)) === "1";
  } catch {
    return false;
  }
}

/** Pops up when a gear checklist is under 100% after its scheduled leave / due-back time. */
export function GearChecklistDuePopup() {
  const [due, setDue] = useState<Due[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/event-checklist/due", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { due?: Due[] };
      setDue((json.due ?? []).filter((d) => !dismissed(d)));
    } catch {
      // offline or signed out: stay quiet
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 120_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const current = due[0];
  if (!current) return null;

  function dismiss() {
    try {
      localStorage.setItem(key(current), "1");
    } catch {
      // ignore
    }
    setDue((list) => list.filter((d) => key(d) !== key(current)));
  }

  const step = current.pass === "out" ? "checked out of the warehouse" : "checked back in";
  return (
    <div
      role="alertdialog"
      aria-labelledby="gear-popup-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xl dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 sm:bottom-6"
    >
      <p id="gear-popup-title" className="text-sm font-semibold">
        Gear check: {current.name}
      </p>
      <p className="mt-1 text-sm">
        The scheduled time has passed and the gear is only {current.percent}% {step}.{" "}
        {current.remainingItems} item{current.remainingItems === 1 ? " is" : "s are"} still waiting.
      </p>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/event-checklist/${current.projectId}`}
          onClick={dismiss}
          className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white"
        >
          Open checklist
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium"
        >
          Dismiss
        </button>
      </div>
      {due.length > 1 ? (
        <p className="mt-2 text-xs">{due.length - 1} more checklist{due.length === 2 ? "" : "s"} waiting.</p>
      ) : null}
    </div>
  );
}
