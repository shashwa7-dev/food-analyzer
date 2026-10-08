"use client";

// Client-only, with the chart's exact box as the placeholder (see components/progress/charts.tsx).
import dynamic from "next/dynamic";

export const WeightLine = dynamic(() => import("./weight-line"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-full rounded-[14px] bg-sunken/60" />,
});
