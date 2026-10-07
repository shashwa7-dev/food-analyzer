"use client";
import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { ScanView } from "@/lib/scans/service";
import { activeStep, SCAN_STEPS, stepState } from "./progress-steps";

export const POLL_EVERY_MS = 2_000;
const isRunning = (v: ScanView | undefined) => !v || v.status === "queued" || v.status === "processing";

/**
 * "Analysing" screen for a queued/processing scan: polls GET /scans/:id every 2 s while it runs,
 * advances the cosmetic steps on a timer, and calls `onFinished` once the scan is done or failed.
 */
export function ScanProgress({ scanId, onFinished }: { scanId: string; onFinished: (view: ScanView) => void }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const scan = useQuery({
    queryKey: ["scans", scanId],
    queryFn: () => api<ScanView>(`/api/v1/scans/${scanId}`),
    refetchInterval: (q) => (isRunning(q.state.data) && !q.state.error ? POLL_EVERY_MS : false),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 3,
  });
  const done = !isRunning(scan.data);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [done]);

  const finish = useEffectEvent((v: ScanView) => onFinished(v));
  useEffect(() => {
    if (!done || !scan.data) return;
    const t = setTimeout(() => finish(scan.data), 450); // let the last tick show
    return () => clearTimeout(t);
  }, [done, scan.data]);

  const active = activeStep(now - startedAt, done);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="title text-[30px] md:text-[34px]">Analysing</h1>
      {scan.isError ? (
        <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-card">
          <p role="alert">{scan.error instanceof ApiError && scan.error.status === 404 ? "That scan was deleted." : "Couldn't check on the scan. It will be in History when it's ready."}</p>
          <Link href="/history" className="flex min-h-11 items-center font-semibold text-accent">Go to History</Link>
        </section>
      ) : (
        <section className="grid gap-3.5 rounded-lg border border-line bg-surface p-5 shadow-card" aria-live="polite">
          {SCAN_STEPS.map((label, i) => {
            const s = stepState(i, active);
            return (
              <div key={label} className={`flex items-center gap-3 font-semibold ${s === "wait" ? "text-subtle" : ""}`}>
                <span
                  aria-hidden
                  className={`grid size-[26px] flex-none place-items-center rounded-full border-2 ${
                    s === "done" ? "border-ok bg-ok text-surface" : s === "active" ? "animate-spin border-accent border-t-transparent motion-reduce:animate-none motion-reduce:border-t-accent" : "border-line"
                  }`}
                >
                  {s === "done" && <Check className="size-4" strokeWidth={3} />}
                </span>
                {label}
                <span className="sr-only">{s === "done" ? " — done" : s === "active" ? " — in progress" : ""}</span>
              </div>
            );
          })}
        </section>
      )}
      <p className="text-sm text-subtle">Usually 5–15 seconds. You can leave this screen. The result will be in History.</p>
    </div>
  );
}
