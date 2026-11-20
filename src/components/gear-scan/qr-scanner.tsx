"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Called with the raw text of each code seen. The same code repeats at most every 3 seconds. */
  onCode: (raw: string) => void;
  /** Keep the camera on but ignore codes (while a scan is being saved). */
  paused?: boolean;
};

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> };
type DetectorCtor = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

const REPEAT_MS = 3000;
const FRAME_MS = 180;
const MAX_WIDTH = 720;

function cameraMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "The camera is blocked. Allow camera access for the hub in your browser settings, then tap Start camera again. You can also type the tag number below.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device. Type the tag number below instead.";
  }
  return "The camera could not start. Type the tag number below instead.";
}

/** Phone camera that reads QR codes (and plain barcodes where the browser supports them). */
export function QrScanner({ onCode, paused = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const pausedRef = useRef(paused);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = paused;
  }, [onCode, paused]);

  useEffect(() => {
    if (!on) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const last = { code: "", at: 0 };

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (stopped || !video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();

        let detector: Detector | null = null;
        const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        if (Ctor) {
          try {
            const supported = (await Ctor.getSupportedFormats?.()) ?? [];
            if (supported.includes("qr_code")) {
              detector = new Ctor({
                formats: ["qr_code", "code_128", "code_39"].filter((f) => supported.includes(f)),
              });
            }
          } catch {
            detector = null;
          }
        }
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (stopped) return;
          try {
            if (!pausedRef.current && video.readyState >= 2 && video.videoWidth > 0) {
              let value = "";
              if (detector) {
                value = (await detector.detect(video))[0]?.rawValue ?? "";
              } else if (jsQR && ctx) {
                const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
                const w = Math.round(video.videoWidth * scale);
                const h = Math.round(video.videoHeight * scale);
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                value = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? "";
              }
              const now = Date.now();
              if (value && (value !== last.code || now - last.at > REPEAT_MS)) {
                last.code = value;
                last.at = now;
                onCodeRef.current(value);
              }
            }
          } catch {
            // A single bad frame is not worth stopping the camera for.
          }
          timer = window.setTimeout(tick, FRAME_MS);
        };
        void tick();
      } catch (e) {
        if (!stopped) {
          setError(cameraMessage(e));
          setOn(false);
        }
      }
    }
    void start();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on]);

  return (
    <div className="space-y-2">
      {on ? (
        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-black">
          <video ref={videoRef} playsInline muted className="block max-h-[46vh] w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-lg border-2 border-white/80" />
          </div>
          {paused ? (
            <p className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1 text-center text-xs text-white">
              Saving…
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOn((v) => !v);
        }}
        className="w-full rounded-lg bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white"
      >
        {on ? "Stop camera" : "Start camera"}
      </button>
      {error ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
