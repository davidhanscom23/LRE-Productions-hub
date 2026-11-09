"use client";

/**
 * Inquiry Forms public renderer - optional Cloudflare Turnstile.
 *
 * Active only when the public bundle carries `turnstileSiteKey` (the server sets it when both Turnstile
 * keys exist). One invisible-unless-needed widget stays mounted for the whole form; `getToken()` waits for
 * a token (up to 8 s, less when the widget reported an error), hands it out once and resets the widget so
 * the next call (complete) gets a fresh one. Without a key nothing loads and `getToken()` resolves null.
 * The server refuses a start or complete without a token, so the renderer never sends null when enabled.
 */
import { useCallback, useEffect, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_WAIT_MS = 8000;

let loader: Promise<TurnstileApi | null> | null = null;

function turnstileApi(): TurnstileApi | null {
  const t = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  return t && typeof t.render === "function" ? t : null;
}

function loadTurnstile(): Promise<TurnstileApi | null> {
  const ready = turnstileApi();
  if (ready) return Promise.resolve(ready);
  if (loader) return loader;
  loader = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve(turnstileApi());
    s.onerror = () => {
      loader = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loader;
}

export function useTurnstile(siteKey: string | null) {
  const container = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  /** The widget reported an error (no token is coming until it recovers). */
  const failed = useRef(false);

  /** Callback ref for the widget slot (attached before effects run). */
  const attach = useCallback((el: HTMLDivElement | null) => {
    container.current = el;
  }, []);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    void loadTurnstile().then((api) => {
      if (cancelled || !api || !container.current) return;
      widgetId.current = api.render(container.current, {
        sitekey: siteKey,
        appearance: "interaction-only",
        size: "flexible",
        action: "inquiry",
        callback: (t: string) => {
          token.current = t;
          failed.current = false;
        },
        "expired-callback": () => {
          token.current = null;
        },
        "error-callback": () => {
          token.current = null;
          failed.current = true;
        },
      });
    });
    return () => {
      cancelled = true;
      const api = turnstileApi();
      if (api && widgetId.current) {
        try {
          api.remove(widgetId.current);
        } catch {
          // widget already gone
        }
      }
      widgetId.current = null;
      token.current = null;
    };
  }, [siteKey]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!siteKey) return null;
    const deadline = Date.now() + TOKEN_WAIT_MS;
    while (!token.current && !failed.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const t = token.current;
    token.current = null;
    const api = turnstileApi();
    if (t && api && widgetId.current) {
      try {
        api.reset(widgetId.current);
      } catch {
        // a missing fresh token only matters if the server requires one again
      }
    }
    return t;
  }, [siteKey]);

  return { attach, getToken, enabled: Boolean(siteKey) };
}
