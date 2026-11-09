"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/**
 * Renders a drawer or dialog straight under <body>. Inside the page they sat in the app shell's
 * `relative z-10` content wrapper (a stacking context capped at z-10), so the hub's fixed skin art
 * (the Wu Wednesday hive and its widget at z 40-44) painted over the open modal and its backdrop.
 * Under <body> the modal's own z-index wins and it uses the base (opaque) theme tokens.
 *
 * Client only: nothing renders on the server or during hydration, then the portal mounts. Put the
 * modal's hooks (focus trap, refs) in the child component so they run once the panel exists.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const onClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return onClient ? createPortal(children, document.body) : null;
}
