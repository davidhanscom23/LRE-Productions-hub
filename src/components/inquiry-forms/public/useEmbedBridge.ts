"use client";

/**
 * Inquiry Forms public renderer - the iframe side of the embed protocol.
 *
 * In embed mode (`?embed=1`) the form posts `ready`, then its content height (see height-reporter.ts),
 * `step` on every step change, `submitted` when the form opts into host events, and `redirect` when the
 * whole host page should move on. Messages carry no visitor data. They are addressed to the parent's
 * origin when the browser tells us what it is (location.ancestorOrigins, else the referrer origin) and
 * to "*" otherwise. The only message accepted back is `redirect-ack`, and only from window.parent.
 */
import { useCallback, useEffect, useMemo, type RefObject } from "react";
import type { FormToHostMessage } from "@/lib/inquiry-forms/types";
import { EMBED_MESSAGE_SOURCE } from "@/lib/inquiry-forms/types";
import { isHostMessage } from "@/lib/inquiry-forms/embed-protocol";
import { startHeightReporter } from "./height-reporter";

export const REDIRECT_ACK_TIMEOUT_MS = 1500;

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type FormMessageBody = DistributiveOmit<FormToHostMessage, "source" | "v" | "slug">;

function isFramed(): boolean {
  try {
    return typeof window !== "undefined" && window.parent !== window;
  } catch {
    return true;
  }
}

/** Best guess at the embedding page's origin; "*" when the browser does not say. */
export function parentTargetOrigin(): string {
  if (typeof window === "undefined") return "*";
  try {
    const ancestors = window.location.ancestorOrigins;
    if (ancestors && ancestors.length > 0) {
      const o = ancestors[0];
      if (o && o !== "null" && /^https?:\/\//.test(o)) return o;
    }
  } catch {
    // ignore, fall back to the referrer
  }
  try {
    if (document.referrer) {
      const u = new URL(document.referrer);
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin;
    }
  } catch {
    // ignore
  }
  return "*";
}

export interface EmbedBridge {
  /** Post one protocol message to the parent (no-op when not embedded). */
  post: (body: FormMessageBody) => void;
  /**
   * Ask the host page to navigate to `url`. Resolves true when the host script acknowledged within
   * 1.5 s (it navigates the whole page), false otherwise (no host script: show a manual link).
   */
  requestRedirect: (url: string) => Promise<boolean>;
}

export function useEmbedBridge(opts: {
  enabled: boolean;
  slug: string;
  contentRef: RefObject<HTMLElement | null>;
}): EmbedBridge {
  const { enabled, slug, contentRef } = opts;

  const post = useCallback(
    (body: FormMessageBody) => {
      if (!enabled || !isFramed()) return;
      const message = { source: EMBED_MESSAGE_SOURCE, v: 1, slug, ...body } as FormToHostMessage;
      try {
        window.parent.postMessage(message, parentTargetOrigin());
      } catch {
        // A wrong target origin throws only for malformed strings; the host simply misses one message.
      }
    },
    [enabled, slug],
  );

  useEffect(() => {
    if (!enabled) return;
    const el = contentRef.current;
    if (!el) return;
    post({ type: "ready" });
    return startHeightReporter(el, (height) => post({ type: "height", height }));
  }, [enabled, contentRef, post]);

  const requestRedirect = useCallback(
    (url: string) =>
      new Promise<boolean>((resolve) => {
        if (!enabled || !isFramed()) {
          resolve(false);
          return;
        }
        let settled = false;
        const expected = parentTargetOrigin();
        const finish = (acked: boolean) => {
          if (settled) return;
          settled = true;
          window.removeEventListener("message", onMessage);
          window.clearTimeout(timer);
          resolve(acked);
        };
        const onMessage = (e: MessageEvent) => {
          if (e.source !== window.parent) return;
          if (expected !== "*" && e.origin !== expected) return;
          if (!isHostMessage(e.data)) return;
          finish(true);
        };
        window.addEventListener("message", onMessage);
        const timer = window.setTimeout(() => finish(false), REDIRECT_ACK_TIMEOUT_MS);
        post({ type: "redirect", url });
      }),
    [enabled, post],
  );

  return useMemo(() => ({ post, requestRedirect }), [post, requestRedirect]);
}
