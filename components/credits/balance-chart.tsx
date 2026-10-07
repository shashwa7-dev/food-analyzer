"use client";

// Client-only like the Progress charts (spec §7): Recharts measures its container. The placeholder
// has the plot's exact box so nothing shifts when it mounts.
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import { ChartCard, CardNote } from "@/components/progress/chart-card";
import type { BalancePoint } from "./balance-chart-plot";

const Plot = dynamic(() => import("./balance-chart-plot"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[150px] rounded-[14px] bg-sunken/60 md:h-[180px]" />,
});

/** The credits page's chart card: "{n} of {allowance} left", the month, and the balance per day. */
export function BalanceChart({ credits, allowance, month, points, today, end }: {
  credits: number; allowance: number; month: string; points: BalancePoint[]; today: string; end: string;
}) {
  return (
    <ChartCard icon={Sparkles} title={`${credits} of ${allowance} left`} aside={<CardNote>{month}</CardNote>}>
      <div role="img" aria-label={`AI scans left during ${month}: ${credits} of ${allowance} today.`}>
        <Plot points={points} allowance={allowance} today={today} end={end} />
      </div>
    </ChartCard>
  );
}
