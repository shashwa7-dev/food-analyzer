// The camera stream's lifecycle, kept free of React and the DOM so it can be unit-tested with fakes:
// start on mount, stop when the tab is hidden (no camera light or battery drain in the background,
// and the barcode sampler pauses with it), restart when it's visible again, stop for good on dispose.
// At most one getUserMedia request is in flight, and a stream that resolves after hide/dispose is
// stopped immediately instead of leaking.

export type CameraState = "starting" | "live" | "paused" | "denied" | "unavailable";

export interface StreamLike {
  getTracks(): { stop(): void }[];
}

export interface CameraEnv<S extends StreamLike> {
  /** Rejects when there is no camera API, permission is refused, or no camera exists. */
  request(): Promise<S>;
  isHidden(): boolean;
  /** Shows the stream in the preview (null clears it). */
  attach(stream: S | null): void;
  report(state: CameraState): void;
}

function stateFor(err: unknown): CameraState {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable";
}

export function createCameraController<S extends StreamLike>(env: CameraEnv<S>) {
  let disposed = false;
  let starting = false;
  let stream: S | null = null;

  const stopTracks = (s: StreamLike) => s.getTracks().forEach((t) => t.stop());

  function stop() {
    if (stream) stopTracks(stream);
    stream = null;
    env.attach(null);
  }

  function start() {
    if (disposed || starting || stream || env.isHidden()) return;
    starting = true;
    env.request().then(
      (s) => {
        starting = false;
        if (disposed || env.isHidden()) return stopTracks(s); // hidden or gone meanwhile: never keep it
        stream = s;
        env.attach(s);
        env.report("live");
      },
      (err: unknown) => {
        starting = false;
        if (!disposed) env.report(stateFor(err));
      },
    );
  }

  return {
    start,
    /** Call on `visibilitychange`. */
    onVisibilityChange() {
      if (disposed) return;
      if (env.isHidden()) {
        const active = stream !== null || starting;
        stop();
        if (active) env.report("paused");
      } else {
        start();
      }
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
