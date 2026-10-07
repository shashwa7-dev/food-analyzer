import { describe, expect, it } from "vitest";
import { createCameraController, type CameraState } from "./camera-controller";

class FakeStream {
  stopped = 0;
  getTracks() { return [{ stop: () => { this.stopped++; } }]; }
}

function setup() {
  let hidden = false;
  const pending: { resolve: (s: FakeStream) => void; reject: (e: unknown) => void }[] = [];
  const states: CameraState[] = [];
  const attached: (FakeStream | null)[] = [];
  const cam = createCameraController<FakeStream>({
    request: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    isHidden: () => hidden,
    attach: (s) => attached.push(s),
    report: (s) => states.push(s),
  });
  return { cam, pending, states, attached, setHidden: (h: boolean) => { hidden = h; } };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("camera controller", () => {
  it("starts once, stops on hide, restarts on show, stops on dispose", async () => {
    const t = setup();
    t.cam.start();
    t.cam.start(); // already starting: no second request
    expect(t.pending).toHaveLength(1);
    const s1 = new FakeStream();
    t.pending[0]!.resolve(s1);
    await tick();
    expect(t.states).toEqual(["live"]);
    expect(t.attached.at(-1)).toBe(s1);

    t.setHidden(true);
    t.cam.onVisibilityChange();
    expect(s1.stopped).toBe(1);
    expect(t.attached.at(-1)).toBeNull();
    expect(t.states.at(-1)).toBe("paused");

    t.setHidden(false);
    t.cam.onVisibilityChange();
    t.cam.onVisibilityChange(); // repeated event while the restart is pending: still one request
    expect(t.pending).toHaveLength(2);
    const s2 = new FakeStream();
    t.pending[1]!.resolve(s2);
    await tick();
    expect(t.states.at(-1)).toBe("live");

    t.cam.dispose();
    expect(s2.stopped).toBe(1);
    expect(t.attached.at(-1)).toBeNull();
  });

  it("stops a stream that resolves after dispose instead of leaking it", async () => {
    const t = setup();
    t.cam.start();
    t.cam.dispose();
    const late = new FakeStream();
    t.pending[0]!.resolve(late);
    await tick();
    expect(late.stopped).toBe(1);
    expect(t.states).toEqual([]);
    expect(t.attached.filter(Boolean)).toEqual([]);
  });

  it("stops a stream that resolves while hidden, then starts fresh when visible", async () => {
    const t = setup();
    t.cam.start();
    t.setHidden(true);
    t.cam.onVisibilityChange();
    expect(t.states).toEqual(["paused"]);
    const late = new FakeStream();
    t.pending[0]!.resolve(late);
    await tick();
    expect(late.stopped).toBe(1);
    t.setHidden(false);
    t.cam.onVisibilityChange();
    expect(t.pending).toHaveLength(2);
  });

  it("does not request while hidden, and reports denied / unavailable", async () => {
    const t = setup();
    t.setHidden(true);
    t.cam.start();
    expect(t.pending).toHaveLength(0);
    t.setHidden(false);
    t.cam.onVisibilityChange();
    t.pending[0]!.reject(new DOMException("no", "NotAllowedError"));
    await tick();
    expect(t.states).toEqual(["denied"]);
    t.setHidden(true);
    t.cam.onVisibilityChange(); // nothing was running: stays "denied", no "paused"
    expect(t.states).toEqual(["denied"]);
    t.setHidden(false);
    t.cam.onVisibilityChange(); // retried on return (permission may have been granted meanwhile)
    t.pending[1]!.reject(new Error("no camera"));
    await tick();
    expect(t.states).toEqual(["denied", "unavailable"]);
  });
});
