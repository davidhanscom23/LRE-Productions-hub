"use client";

/**
 * Inquiry Forms - the "not available" message for a paused, archived, unpublished or unknown form.
 *
 * Inside a website's embed iframe it speaks the embed protocol like the live form (ready, then its
 * content height), so embed.js sizes the frame to the message instead of leaving the initial 560 px
 * white block, and it drops the card chrome the way the live embed does. The page cannot read
 * ?embed=1 (not-found pages get no props), so it checks whether it is framed.
 */
import { useRef, useSyncExternalStore } from "react";
import { useEmbedBridge } from "./useEmbedBridge";

const noopSubscribe = () => () => {};

function framedNow(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

/** "/inquire/<slug>" -> slug ("" for any other path). */
export function slugFromInquirePath(pathname: string): string {
  const m = /^\/inquire\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
  return m ? m[1] : "";
}

export function UnavailableNotice() {
  const contentRef = useRef<HTMLDivElement>(null);
  const framed = useSyncExternalStore(noopSubscribe, framedNow, () => false);
  const slug = useSyncExternalStore(
    noopSubscribe,
    () => slugFromInquirePath(window.location.pathname),
    () => "",
  );
  useEmbedBridge({ enabled: framed && slug !== "", slug, contentRef });

  return (
    // No iqf-standalone: its 100dvh min-height has no place inside an embed iframe.
    <div ref={contentRef} className={framed ? "iqf-root iqf-embed" : "iqf-root"}>
      <main id="iqf-form" className="iqf-main" tabIndex={-1}>
        <div className="iqf-column">
          <div className="iqf-card">
            <h1 className="iqf-step-title">This form is not available right now</h1>
            <p className="iqf-step-desc">
              It may have been paused or moved. Please check back soon, or contact the business directly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
