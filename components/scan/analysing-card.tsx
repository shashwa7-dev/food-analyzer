"use client";
import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, History, ShieldCheck, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { analysingStep } from "@/lib/scans/modes";
import type { ScanView } from "@/lib/scans/service";
import { isSlow, SCAN_STEPS, stepState } from "./progress-steps";
import { ScanStage } from "./scan-stage";

export const POLL_EVERY_MS = 2_000;
const isRunning = (v: ScanView | undefined) => !v || v.status === "queued" || v.status === "processing";

/**
 * "Analysing" (spec §6.10) for a queued/processing scan: the last photo blurred behind a white card
 * (a plain viewfinder ground on /scans/[id], where there is no photo), polling GET /scans/:id every
 * 2 s. The four steps are cosmetic (analysingStep); `onFinished` runs once the scan is done or failed.
 */
export function AnalysingCard({ scanId, photoUrl = null, onFinished }: {
  scanId: string;
  photoUrl?: string | null;
  onFinished: (view: ScanView) => void;
}) {
  const qc = useQueryClient();
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(mountedAt);
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
    // The scan's name/grade (or failure) only exist from this point — refresh /history now.
    void qc.invalidateQueries({ queryKey: ["scans"] });
    const t = setTimeout(() => finish(scan.data), 450); // let the last step show
    return () => clearTimeout(t);
  }, [done, scan.data, qc]);

  const current = analysingStep(now - mountedAt, done);
  const slow = isSlow(scan.data?.createdAt, mountedAt, now);
  const lost = scan.isError;

  return (
    <ScanStage label="Analysing">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, never stored or optimised
        <img src={photoUrl} alt="" aria-hidden className="absolute inset-0 -z-10 size-full scale-[1.06] object-cover blur-[6px] brightness-[.7]" />
      )}
      <div aria-hidden className="scan-scrim absolute inset-0 -z-10" />
      <div className="relative mx-3.5 mt-auto mb-[18px] grid gap-4 rounded-[28px] bg-surface p-5 text-ink shadow-[0_20px_40px_color-mix(in_srgb,var(--viewfinder)_35%,transparent)] md:mx-auto md:mb-8 md:w-full md:max-w-[420px]">
        {lost ? (
          <div role="alert" className="grid gap-4">
            <div className="flex items-center gap-3">
              <IconTile tone="bad" size="md"><TriangleAlert /></IconTile>
              <p className="m-0 text-[15px] leading-snug">
                {scan.error instanceof ApiError && scan.error.status === 404 ? "That scan was deleted." : "Couldn't check on the scan. It will be in History when it's ready."}
              </p>
            </div>
            <Button render={<Link href="/history" />} nativeButton={false} shape="pill" size="xl" className="h-[54px] w-full">
              <History aria-hidden /> Go to History
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span aria-hidden className="size-9 shrink-0 rounded-full border-4 border-brand-soft border-t-brand-deep motion-safe:animate-spin" />
              <div className="min-w-0 leading-snug">
                <h1 className="m-0 text-[17px] font-semibold">Analysing your photos</h1>
                <p className="m-0 text-[13px] text-subtle" aria-live="polite">
                  {slow ? "Still working. It'll be in History when it's ready." : "Usually 5–10 seconds"}
                </p>
              </div>
            </div>
            <ol className="m-0 grid list-none gap-3 p-0" aria-label="Progress">
              {SCAN_STEPS.map((label, i) => {
                const s = stepState(i, current);
                return (
                  <li
                    key={label}
                    aria-current={s === "active" ? "step" : undefined}
                    className={`flex items-center gap-2.5 text-[14.5px] whitespace-nowrap ${s === "wait" ? "text-subtle" : s === "active" ? "font-semibold text-ink" : "text-ink"}`}
                  >
                    {s === "done" ? (
                      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-deep text-surface">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : s === "active" ? (
                      <span aria-hidden className="size-5 shrink-0 rounded-full bg-brand shadow-[0_0_0_5px_var(--brand-soft)] motion-safe:animate-dot-pulse" />
                    ) : (
                      <Clock className="size-5 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{label}</span>
                    <span className="sr-only">{s === "done" ? ", done" : s === "active" ? ", in progress" : ""}</span>
                  </li>
                );
              })}
            </ol>
            {!slow && <p className="m-0 text-[12.5px] text-subtle">You can leave this screen. The result will be in History.</p>}
            <p className="m-0 flex items-center gap-2 border-t border-line pt-3 text-[13px] text-subtle">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              If this fails, your scan is refunded.
            </p>
          </>
        )}
      </div>
    </ScanStage>
  );
}
