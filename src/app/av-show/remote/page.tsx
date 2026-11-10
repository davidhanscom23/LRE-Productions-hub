"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ShowState = {
  event?: string;
  onair?: string;
  blackout?: boolean;
  items?: { t?: string }[];
  sel?: number;
  live?: number;
  timerRem?: number | null;
  timerLabel?: string;
  msg?: string;
};

const PRIMARY: { c: string; label: string; v?: string; danger?: boolean }[] = [
  { c: "takestaged", label: "Take" },
  { c: "next", label: "Next" },
  { c: "prev", label: "Prev" },
  { c: "clearlt", label: "Clear LT" },
  { c: "logo", label: "Logo" },
  { c: "panic", label: "PANIC", danger: true },
];

const MORE: { c: string; label: string; v?: string }[] = [
  { c: "test", label: "Test" },
  { c: "loop", label: "Sponsors" },
  { c: "slideshow", label: "Slideshow" },
  { c: "tmmsg", label: "WRAP UP", v: "WRAP UP" },
  { c: "tmclear", label: "Clear msg" },
];

function readSavedPin(): string {
  try {
    return sessionStorage.getItem("av-show-remote-pin") || "";
  } catch {
    return "";
  }
}

export default function AvShowRemotePage() {
  const [pin, setPin] = useState(readSavedPin);
  const [connectedPin, setConnectedPin] = useState<string | null>(null);
  const [state, setState] = useState<ShowState | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerMins, setTimerMins] = useState("10");
  const autoTried = useRef(false);

  const connect = useCallback(async (raw: string) => {
    const cleaned = raw.replace(/\D/g, "").slice(0, 8);
    if (cleaned.length < 4) {
      setError("Enter the 4-digit PIN from the control page.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/av-show/state?pin=${encodeURIComponent(cleaned)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not connect.");
        setConnectedPin(null);
        return;
      }
      setConnectedPin(cleaned);
      setState((data.state as ShowState) || {});
      setExpiresAt(typeof data.expiresAt === "string" ? data.expiresAt : null);
      try {
        sessionStorage.setItem("av-show-remote-pin", cleaned);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (autoTried.current || !pin) return;
    autoTried.current = true;
    void connect(pin);
  }, [pin, connect]);

  useEffect(() => {
    if (!connectedPin) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/av-show/state?pin=${encodeURIComponent(connectedPin)}`,
        );
        if (!res.ok) {
          setError("Session expired. Ask the operator for a new PIN.");
          setConnectedPin(null);
          return;
        }
        const data = await res.json();
        setState((data.state as ShowState) || {});
        if (typeof data.expiresAt === "string") setExpiresAt(data.expiresAt);
      } catch {
        /* ignore transient */
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [connectedPin]);

  async function sendCmd(c: string, v = "") {
    if (!connectedPin) return;
    setError(null);
    const res = await fetch("/api/av-show/cmd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: connectedPin, c, v }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Command failed.");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void connect(pin);
  }

  const timerText = useMemo(() => {
    if (state?.timerRem == null) return null;
    const sec = Math.max(0, Math.round(Number(state.timerRem) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}${
      state.timerLabel ? ` · ${state.timerLabel}` : ""
    }`;
  }, [state]);

  const expiryText = useMemo(() => {
    if (!expiresAt) return null;
    try {
      return `PIN until ${new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(expiresAt))} ET`;
    } catch {
      return null;
    }
  }, [expiresAt]);

  return (
    <div className="min-h-screen bg-[#0e0e0e] px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e0393e]">
            AV Show Control
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Phone remote</h1>
          <p className="mt-1 text-sm text-[#9a9a9a]">
            Enter the PIN from the Hub control page. Works over the internet —
            same Wi-Fi is not required.
          </p>
        </header>

        {!connectedPin ? (
          <form
            onSubmit={onSubmit}
            className="space-y-3 rounded-2xl border border-[#383838] bg-[#181818] p-4"
          >
            <label className="block text-sm">
              <span className="mb-1 block text-[#9a9a9a]">PIN</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-[#383838] bg-[#0e0e0e] px-3 py-3 text-center text-2xl tracking-[0.4em]"
                placeholder="••••"
                autoFocus
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#e0393e] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              Connect
            </button>
          </form>
        ) : (
          <>
            <div className="rounded-2xl border border-[#383838] bg-[#181818] p-4">
              <p className="text-xs uppercase tracking-wide text-[#9a9a9a]">
                Connected · PIN {connectedPin}
                {expiryText ? ` · ${expiryText}` : ""}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {state?.event || "Show"}
              </p>
              <p className="mt-1 text-sm text-[#e0393e]">
                {state?.blackout
                  ? "BLACKOUT"
                  : state?.onair || "Standing by"}
              </p>
              {timerText ? (
                <p className="mt-2 font-mono text-xl">{timerText}</p>
              ) : null}
              {state?.msg ? (
                <p className="mt-1 text-sm text-[#9a9a9a]">{state.msg}</p>
              ) : null}
              <button
                type="button"
                className="mt-3 text-xs text-[#9a9a9a] underline"
                onClick={() => {
                  setConnectedPin(null);
                  try {
                    sessionStorage.removeItem("av-show-remote-pin");
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Disconnect
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PRIMARY.map((cmd) => (
                <button
                  key={`${cmd.c}-${cmd.v ?? ""}`}
                  type="button"
                  onClick={() => void sendCmd(cmd.c, cmd.v ?? "")}
                  className={
                    cmd.danger
                      ? "rounded-xl border border-red-800 bg-red-950 px-3 py-4 text-sm font-semibold text-red-100 active:bg-red-900"
                      : "rounded-xl border border-[#383838] bg-[#181818] px-3 py-4 text-sm font-semibold active:bg-[#262626]"
                  }
                >
                  {cmd.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-[#383838] bg-[#181818] p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9a9a9a]">
                Stage timer
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={timerMins}
                  onChange={(e) => setTimerMins(e.target.value)}
                  className="w-20 rounded-lg border border-[#383838] bg-[#0e0e0e] px-2 py-2 text-center"
                />
                <span className="text-sm text-[#9a9a9a]">min</span>
                <button
                  type="button"
                  className="rounded-lg bg-[#e0393e] px-3 py-2 text-sm font-semibold text-black"
                  onClick={() =>
                    void sendCmd("tmstart", String(Number(timerMins) || 10))
                  }
                >
                  Start
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[#383838] px-3 py-2 text-sm"
                  onClick={() => void sendCmd("tmstop")}
                >
                  Stop
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-[#383838] px-3 py-2 text-sm"
                  onClick={() => void sendCmd("tmminus")}
                >
                  −1 min
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-[#383838] px-3 py-2 text-sm"
                  onClick={() => void sendCmd("tmplus")}
                >
                  +1 min
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MORE.map((cmd) => (
                <button
                  key={`${cmd.c}-${cmd.v ?? ""}`}
                  type="button"
                  onClick={() => void sendCmd(cmd.c, cmd.v ?? "")}
                  className="rounded-xl border border-[#383838] bg-[#181818] px-3 py-3 text-sm font-semibold active:bg-[#262626]"
                >
                  {cmd.label}
                </button>
              ))}
            </div>

            {Array.isArray(state?.items) && state.items.length > 0 ? (
              <div className="rounded-2xl border border-[#383838] bg-[#181818] p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9a9a9a]">
                  Take by item
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {state.items.map((it, i) => (
                    <button
                      key={`${i}-${it.t ?? ""}`}
                      type="button"
                      onClick={() => void sendCmd("take", String(i))}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                        state.live === i
                          ? "bg-[#e0393e]/20 text-[#e0393e]"
                          : "bg-[#0e0e0e] text-white"
                      }`}
                    >
                      {i + 1}. {it.t || "Item"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        {error ? (
          <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
