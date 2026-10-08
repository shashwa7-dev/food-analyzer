import type { FitnessSummary, WeightHistory } from "@/lib/fitness/types";

// Placeholder: built out in the next slice (workouts-layout.html ②).
export function EmptyHub({ summary, weight }: { summary: FitnessSummary; weight: WeightHistory }) {
  void summary;
  void weight;
  return <h1 className="m-0 text-[30px] font-[650] tracking-[-0.04em] text-ink md:text-[40px]">Workouts</h1>;
}
