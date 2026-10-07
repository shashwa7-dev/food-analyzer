"use client";

// Charts render on the client only (spec §7): Recharts measures its container and the EvilCharts
// intros read the clock, neither of which can match a server render. Each placeholder has the
// chart's exact box so nothing shifts when it mounts.
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const Placeholder = ({ className }: { className: string }) => <div aria-hidden className={cn("rounded-[14px] bg-sunken/60", className)} />;

export const CaloriesChart = dynamic(() => import("./calories-chart"), {
  ssr: false,
  loading: () => <Placeholder className="h-[170px] md:h-[220px]" />,
});
export const BalanceRadar = dynamic(() => import("./balance-radar"), {
  ssr: false,
  loading: () => <Placeholder className="mx-auto size-[240px] rounded-full" />,
});
export const SodiumLine = dynamic(() => import("./sodium-line"), {
  ssr: false,
  loading: () => <Placeholder className="h-[150px] md:h-[190px]" />,
});
// The donut sizes itself from props; its placeholder is the same ring box (see donut.tsx).
export const Donut = dynamic(() => import("./donut"), {
  ssr: false,
  loading: () => <Placeholder className="size-[var(--donut)] shrink-0 rounded-full" />,
});
