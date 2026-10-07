"use client";
import { useEffect, useEffectEvent, useState, type ReactNode, type RefObject } from "react";
import { CameraOff } from "lucide-react";
import { getBarcodeReader } from "./barcode-reader";
import { fitWithin } from "./compress";

export type CameraState = "starting" | "live" | "denied" | "unavailable";

/** How often a preview frame is checked for a barcode. */
export const SAMPLE_EVERY_MS = 300;
/** Frames are downscaled to this long edge before decoding — plenty for an EAN, much cheaper. */
const SAMPLE_EDGE_PX = 1280;

function stateFor(err: unknown): CameraState {
  const name = err instanceof DOMException ? err.name : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable";
}

/**
 * Live rear-camera preview with the corner frame and hint. While `detecting`, samples a frame every
 * 300 ms and reports the first valid barcode. All tracks are stopped on unmount. When the camera is
 * denied or missing, renders a message instead (the photo buttons outside stay available).
 */
export function Camera({ videoRef, detecting, onBarcode, onStateChange, status }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  detecting: boolean;
  onBarcode: (code: string) => void;
  onStateChange?: (state: CameraState) => void;
  /** Pill shown at the bottom of the preview (barcode status). */
  status?: ReactNode;
}) {
  const [state, setState] = useState<CameraState>("starting");
  const report = useEffectEvent((s: CameraState) => {
    setState(s);
    onStateChange?.(s);
  });
  const found = useEffectEvent((code: string) => onBarcode(code));

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    const start = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      : Promise.reject(new DOMException("No camera API", "NotFoundError"));
    start.then(
      (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video) {
          video.srcObject = s;
          void video.play().catch(() => undefined); // autoPlay + muted normally covers this
        }
        report("live");
      },
      (err: unknown) => { if (!cancelled) report(stateFor(err)); },
    );
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [videoRef]);

  useEffect(() => {
    if (!detecting || state !== "live") return;
    let stopped = false;
    let busy = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const reader = getBarcodeReader();
    const timer = setInterval(async () => {
      const v = videoRef.current;
      if (busy || stopped || !ctx || !v || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !v.videoWidth) return;
      busy = true;
      try {
        const { width, height } = fitWithin(v.videoWidth, v.videoHeight, SAMPLE_EDGE_PX);
        if (canvas.width !== width || canvas.height !== height) [canvas.width, canvas.height] = [width, height];
        ctx.drawImage(v, 0, 0, width, height);
        const code = await (await reader).read(canvas);
        if (code && !stopped) found(code);
      } catch {
        // a frame that can't be read is just "no barcode yet"
      } finally {
        busy = false;
      }
    }, SAMPLE_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [detecting, state, videoRef]);

  const blocked = state === "denied" || state === "unavailable";
  return (
    <div className="relative aspect-[3/4] max-h-[62dvh] w-full overflow-hidden rounded-lg bg-viewfinder text-on-media md:aspect-[4/3]">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
        className={`absolute inset-0 size-full object-cover ${blocked ? "hidden" : ""}`}
      />
      {blocked ? (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <CameraOff className="size-8" aria-hidden />
          <p className="max-w-72 text-base font-semibold">
            {state === "denied" ? "Camera access is off." : "No camera available here."}
          </p>
          <p className="max-w-72 text-sm opacity-80">
            {state === "denied"
              ? "Allow the camera in your browser settings, or take a photo or choose one from your gallery below."
              : "Take a photo or choose one from your gallery below."}
          </p>
        </div>
      ) : (
        <>
          <p className="absolute inset-x-0 top-3.5 text-center text-sm font-semibold [text-shadow:0_1px_3px_rgb(0_0_0)]">
            {state === "starting" ? "Starting the camera…" : "Point at a barcode, a label or your plate"}
          </p>
          <div className="pointer-events-none absolute inset-x-[12%] inset-y-[16%]" aria-hidden>
            <i className="absolute left-0 top-0 size-[34px] border-l-4 border-t-4 border-on-media" />
            <i className="absolute right-0 top-0 size-[34px] border-r-4 border-t-4 border-on-media" />
            <i className="absolute bottom-0 left-0 size-[34px] border-b-4 border-l-4 border-on-media" />
            <i className="absolute bottom-0 right-0 size-[34px] border-b-4 border-r-4 border-on-media" />
          </div>
          {status && (
            <div role="status" aria-live="polite"
              className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full bg-on-media px-3.5 py-2 text-sm font-bold text-on-media-ink">
              {status}
            </div>
          )}
        </>
      )}
    </div>
  );
}
