import type { ReactNode } from "react";
import type { FitnessStats } from "@/lib/fitness/insights";
import type { FitnessSummary, HistoryPage, WeightHistory } from "@/lib/fitness/types";

// Placeholder: built out in a later slice (workouts-full-v3.html).
export function Hub({ stats, summary, weight, history, locked, proSlot, proAside }: {
  stats: FitnessStats; summary: FitnessSummary; weight: WeightHistory; history: HistoryPage;
  locked: boolean; proSlot: ReactNode; proAside: ReactNode;
}) {
  void stats;
  void summary;
  void weight;
  void history;
  void locked;
  return (
    <>
      <h1 className="m-0 text-[30px] font-[650] tracking-[-0.04em] text-ink md:text-[40px]">Workouts</h1>
      {proSlot}
      {proAside}
    </>
  );
}
