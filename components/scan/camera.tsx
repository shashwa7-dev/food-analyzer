"use client";
import { useEffect, useEffectEvent, useState, type RefObject } from "react";
import { CameraOff } from "lucide-react";
import { getBarcodeReader } from "./barcode-reader";
import { fitWithin } from "./compress";
import { createCameraController, type CameraState } from "./camera-controller";

export type { CameraState };

/** How often a preview frame is checked for a barcode. */
export const SAMPLE_EVERY_MS = 300;
/** Frames are downscaled to this long edge before decoding — plenty for an EAN, much cheaper. */
const SAMPLE_EDGE_PX = 1280;

/**
 * Live rear-camera preview filling its (positioned) parent. While `detecting`, samples a frame every
 * 300 ms and reports the first valid barcode. The stream (and so the sampler) stops while the tab is
 * hidden and restarts when it is visible again; all tracks are stopped on unmount. When the camera is
 * denied or missing, renders a message instead (the shutter and gallery button stay available).
 * The scanner chrome (brackets, hint, modes, shutter) is drawn by the caller on top.
 */
export function Camera({ videoRef, detecting, onBarcode, onStateChange }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  detecting: boolean;
  onBarcode: (code: string) => void;
  onStateChange?: (state: CameraState) => void;
}) {
  const [state, setState] = useState<CameraState>("starting");
  const report = useEffectEvent((s: CameraState) => {
    setState(s);
    onStateChange?.(s);
  });
  const found = useEffectEvent((code: string) => onBarcode(code));

  useEffect(() => {
    const video = videoRef.current;
    const camera = createCameraController<MediaStream>({
      request: () => navigator.mediaDevices?.getUserMedia
        ? navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
        : Promise.reject(new DOMException("No camera API", "NotFoundError")),
      isHidden: () => document.hidden,
      attach: (s) => {
        if (!video) return;
        video.srcObject = s;
        if (s) void video.play().catch(() => undefined); // autoPlay + muted normally covers this
      },
      report: (st) => report(st),
    });
    const onVisibility = () => camera.onVisibilityChange();
    camera.start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      camera.dispose();
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
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
        className={`absolute inset-0 size-full object-cover ${blocked ? "hidden" : ""}`}
      />
      {blocked && (
        <div role="status" className="absolute inset-x-0 top-1/2 flex -translate-y-[70%] flex-col items-center gap-3 px-8 text-center">
          <CameraOff className="size-8" aria-hidden />
          <p className="m-0 max-w-72 text-base font-semibold">
            {state === "denied" ? "Camera access is off." : "No camera available here."}
          </p>
          <p className="m-0 max-w-72 text-sm opacity-80">
            {state === "denied"
              ? "Allow the camera in your browser settings, or use the shutter to take a photo, or choose one from your gallery."
              : "Use the shutter to take a photo, or choose one from your gallery."}
          </p>
        </div>
      )}
    </>
  );
}
