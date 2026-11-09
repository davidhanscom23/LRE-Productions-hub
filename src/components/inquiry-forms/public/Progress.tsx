"use client";

/**
 * Inquiry Forms public renderer - progress.
 * From 640px: one labeled segment per step. On phones: "Step N of M: Label" above thin segments
 * (five labels never fit 390px). A progressHype line (playful style) replaces the label in the
 * caption when the form sets one, and also shows on larger screens.
 */
import type { ProgressItem } from "./flow";

export function Progress({
  items,
  current,
  complete,
  hype,
}: {
  items: ProgressItem[];
  current: number;
  complete: boolean;
  hype: string | null;
}) {
  if (items.length < 2) return null;
  const total = items.length;
  const currentItem = items[Math.min(current, total - 1)];
  const caption = hype ?? currentItem?.label ?? "";
  return (
    <div className="iqf-progress">
      <p className="iqf-progress-caption" data-phone-only={hype ? "false" : "true"}>
        <strong>
          Step {Math.min(current + 1, total)} of {total}
        </strong>
        {caption ? `: ${caption}` : null}
      </p>
      <ol className="iqf-progress-track" aria-label="Form steps">
        {items.map((item) => {
          const state = complete || item.index < current ? "done" : item.index === current ? "current" : "todo";
          return (
            <li
              key={item.index}
              className="iqf-seg"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="iqf-seg-bar" aria-hidden="true" />
              <span className="iqf-seg-label">
                {item.label}
                <span className="iqf-sr-only">
                  {state === "done" ? ", completed" : state === "current" ? ", current step" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
