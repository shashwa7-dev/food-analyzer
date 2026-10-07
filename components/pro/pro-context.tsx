"use client";
// The signed-in user's plan for the client's Pro locks and the upgrade sheet (spec §B), set once by the
// app layout: the plan, which gated features are locked right now (PRO_GATES_ENFORCED on, Basic plan),
// and the waitlist state, shared so joining from any sheet shows "You're on the list" everywhere.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { GatedFeature, PlanKey } from "@/lib/credits/plan-features";
import { joinWaitlistAction } from "@/app/(app)/me/credits/actions";

export type ProState = {
  plan: PlanKey;
  /** True for a gated feature this plan can't use while the gates are enforced. */
  locks: Record<GatedFeature, boolean>;
  /** Gates enforced and on Basic: the "200 scans" upsell shows. */
  upsell: boolean;
  onWaitlist: boolean;
  joinWaitlist: () => Promise<void>;
};

const NONE: Record<GatedFeature, boolean> = { progressMonth: false, dataExport: false, customTargets: false };
const ProContext = createContext<ProState>({ plan: "basic", locks: NONE, upsell: false, onWaitlist: false, joinWaitlist: async () => undefined });

export function ProProvider({ plan, locks, onWaitlist, children }: { plan: PlanKey; locks: Record<GatedFeature, boolean>; onWaitlist: boolean; children: ReactNode }) {
  const [joined, setJoined] = useState(false);
  const joinWaitlist = useCallback(async () => {
    try {
      await joinWaitlistAction();
      setJoined(true);
    } catch {
      toast.error("Couldn't join the waitlist. Try again.");
    }
  }, []);
  const upsell = plan !== "pro" && Object.values(locks).some(Boolean);
  const value = useMemo(() => ({ plan, locks, upsell, onWaitlist: onWaitlist || joined, joinWaitlist }), [plan, locks, upsell, onWaitlist, joined, joinWaitlist]);
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export const usePro = () => useContext(ProContext);
