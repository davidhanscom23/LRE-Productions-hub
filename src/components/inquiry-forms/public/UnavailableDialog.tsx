"use client";

/**
 * Inquiry Forms public renderer - "that date is not available" dialog.
 * role="dialog" + aria-modal, focus moves in and is trapped, and it closes ONLY through the X, Escape or
 * one of its buttons (an outside click does nothing). Actions render in the form's settings order:
 * change_date, alternatives (server-provided open dates), waitlist, continue.
 * Embedded, the panel sits at the top of the frame (the host scrolled the frame top into view on the
 * step change), so it is never centered somewhere off screen inside a tall iframe.
 */
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import type { DateResult, DateUnavailableAction } from "@/lib/inquiry-forms/types";
import { formatLongDate, isValidDateString } from "@/lib/inquiry-forms/dates";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function unavailableTitle(date: string | null, result: DateResult): string {
  const d = date && isValidDateString(date) ? formatLongDate(date) : null;
  if (result === "too_soon") return d ? `${d} is too soon for us to book` : "That date is too soon for us to book";
  return d ? `${d} is not available` : "That date is not available";
}

export function UnavailableDialog({
  date,
  result,
  message,
  actions,
  alternatives,
  lockScroll,
  onChangeDate,
  onPickAlternative,
  onWaitlist,
  onContinue,
  onClose,
}: {
  date: string | null;
  result: DateResult;
  message: string;
  actions: DateUnavailableAction[];
  alternatives: string[];
  /** Standalone page: stop the page behind from scrolling while open. */
  lockScroll: boolean;
  onChangeDate: () => void;
  onPickAlternative: (date: string) => void;
  onWaitlist: () => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    first?.focus({ preventScroll: true });
    if (!lockScroll) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [lockScroll]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null || n === document.activeElement,
    );
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === firstNode || document.activeElement === panelRef.current)) {
      e.preventDefault();
      lastNode.focus();
    } else if (!e.shiftKey && document.activeElement === lastNode) {
      e.preventDefault();
      firstNode.focus();
    }
  };

  // Keep focus inside: a press on the backdrop must not move focus to the page behind (and never closes).
  const keepFocus = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) e.preventDefault();
  };

  const primaryAction = actions.find((a) => a !== "alternatives") ?? null;
  const firstAction = actions[0] ?? null;
  const btn = (a: DateUnavailableAction) =>
    a === primaryAction ? "iqf-btn iqf-btn-primary iqf-btn-block" : "iqf-btn iqf-btn-secondary iqf-btn-block";

  return (
    <div className="iqf-dialog-backdrop" onMouseDown={keepFocus}>
      <div
        ref={panelRef}
        className="iqf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="iqf-dialog-title"
        aria-describedby={message ? "iqf-dialog-text" : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="iqf-dialog-close" aria-label="Close" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
        <h2 id="iqf-dialog-title" className="iqf-dialog-title">
          {unavailableTitle(date, result)}
        </h2>
        {message ? (
          <p id="iqf-dialog-text" className="iqf-dialog-text">
            {message}
          </p>
        ) : null}
        <div className="iqf-dialog-actions">
          {actions.map((a) => {
            const auto = a === firstAction ? { "data-autofocus": "" } : {};
            if (a === "change_date") {
              return (
                <button key={a} type="button" className={btn(a)} onClick={onChangeDate} {...auto}>
                  Pick a different date
                </button>
              );
            }
            if (a === "alternatives") {
              return (
                <div key={a} className="iqf-alt-dates" role="group" aria-labelledby="iqf-alt-dates-label">
                  <p id="iqf-alt-dates-label" className="iqf-alt-dates-label">
                    Nearby dates we have open
                  </p>
                  {alternatives.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      className="iqf-btn iqf-btn-secondary iqf-btn-block"
                      onClick={() => onPickAlternative(d)}
                      {...(i === 0 ? auto : {})}
                    >
                      {isValidDateString(d) ? formatLongDate(d) : d}
                    </button>
                  ))}
                </div>
              );
            }
            if (a === "waitlist") {
              return (
                <button key={a} type="button" className={btn(a)} onClick={onWaitlist} {...auto}>
                  Join the waitlist
                </button>
              );
            }
            return (
              <button key={a} type="button" className={btn(a)} onClick={onContinue} {...auto}>
                Send my request anyway
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
